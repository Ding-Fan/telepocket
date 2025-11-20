import { Bot } from 'grammy';
import { config } from '../config/environment';
import { TelegramClient } from './client';
import { classifyCommand } from './commands/classify';
import { startCommand } from './commands/start';
import { helpCommand } from './commands/help';
import { notesCommand, initNotesCommandViews } from './commands/notes';
import { archivedCommand, initArchivedCommandViews } from './commands/archived';
import { linksCommand, initLinksCommandViews } from './commands/links';
import { searchCommand, initSearchCommandViews } from './commands/search';
import { glanceCommand, initGlanceCommandViews } from './commands/glance';
import { suggestCommand, initSuggestCommandViews } from './commands/suggest';
import { callbackHandler, initCallbackHandlerViews } from './handlers/callbacks';
import { messageHandler } from './handlers/messages';
import { showGlanceView } from './views/glance';
import { showSuggestView, showSuggestViewWithQuery } from './views/suggest';

/**
 * Modular Telegram Client - Phase 1
 *
 * For Phase 1, we use a hybrid approach:
 * - Create our own Bot instance
 * - Install the modular classify command
 * - Delegate all other commands to the legacy TelegramClient
 *
 * The trick: We install classify FIRST (higher priority), then let legacy client
 * register its commands. Grammy will process middleware in order, so our modular
 * classify will run first and consume the command.
 *
 * Migration status:
 * - ✅ /classify command (modular in commands/classify.ts)
 * - ⏳ Other commands (delegated to legacy client.ts)
 */
class ModularTelegramClient {
  private bot: Bot;
  private legacyClient: TelegramClient;

  constructor() {
    this.bot = new Bot(config.telegram.botToken);

    // Setup error handling
    this.bot.catch((err) => {
      console.error('Grammy bot error:', err);
    });

    // Install modular commands FIRST (higher priority)
    this.setupModularCommands();

    // Create legacy client - but DON'T let it create its own bot
    // We'll inject our bot instance instead
    this.legacyClient = this.createLegacyClientWithOurBot();
  }

  /**
   * Creates a legacy TelegramClient but uses our Bot instance
   * This is a hack to reuse all legacy commands while using our bot
   */
  private createLegacyClientWithOurBot(): TelegramClient {
    // Create a new TelegramClient
    const client = new TelegramClient();

    // Replace its bot instance with ours
    // @ts-ignore - accessing private property
    client.bot = this.bot;

    // Wire up view functions to modular commands
    // @ts-ignore - accessing private methods
    initNotesCommandViews({
      showNotesPage: client.showNotesPage.bind(client),
      showNotesByCategory: client.showNotesByCategory.bind(client),
      showNoteSearchResults: client.showNoteSearchResults.bind(client),
    });

    // @ts-ignore - accessing private methods
    initArchivedCommandViews({
      showArchivedNotesPage: client.showArchivedNotesPage.bind(client),
      showArchivedNoteSearchResults: client.showArchivedNoteSearchResults.bind(client),
    });

    // @ts-ignore - accessing private methods
    initLinksCommandViews({
      showLinksOnlyPage: client.showLinksOnlyPage.bind(client),
      showLinksOnlySearchResults: client.showLinksOnlySearchResults.bind(client),
    });

    // @ts-ignore - accessing private methods
    initSearchCommandViews({
      showUnifiedSearchResults: client.showUnifiedSearchResults.bind(client),
    });

    // Use imported view functions (no longer in client)
    initGlanceCommandViews({
      showGlanceView: showGlanceView,
    });

    // Use imported view functions (no longer in client)
    initSuggestCommandViews({
      showSuggestView: showSuggestView,
      showSuggestViewWithQuery: showSuggestViewWithQuery,
    });

    // @ts-ignore - accessing private methods
    initCallbackHandlerViews({
      // @ts-ignore
      showLinksPage: client.showLinksPage.bind(client),
      // @ts-ignore
      showSearchResults: client.showSearchResults.bind(client),
      showNotesPage: client.showNotesPage.bind(client),
      showNoteSearchResults: client.showNoteSearchResults.bind(client),
      showLinksOnlyPage: client.showLinksOnlyPage.bind(client),
      showLinksOnlySearchResults: client.showLinksOnlySearchResults.bind(client),
      showNotesByCategory: client.showNotesByCategory.bind(client),
      showNoteDetail: client.showNoteDetail.bind(client),
      showGlanceView: showGlanceView,
      showSuggestView: showSuggestView,
      showSuggestViewWithQuery: showSuggestViewWithQuery,
      showDeleteConfirmation: client.showDeleteConfirmation.bind(client),
      deleteNoteAndReturn: client.deleteNoteAndReturn.bind(client),
      toggleNoteMarkAndRefresh: client.toggleNoteMarkAndRefresh.bind(client),
      showArchivedNotesPage: client.showArchivedNotesPage.bind(client),
      showArchivedNoteSearchResults: client.showArchivedNoteSearchResults.bind(client),
      archiveNoteAndReturn: client.archiveNoteAndReturn.bind(client),
      unarchiveNoteAndReturn: client.unarchiveNoteAndReturn.bind(client),
      showUnifiedSearchResults: client.showUnifiedSearchResults.bind(client),
    });

    return client;
  }

  /**
   * Install modular command composers and handlers with higher priority
   * These will be processed before the legacy client's commands
   */
  private setupModularCommands(): void {
    // Install modular commands - these run first
    this.bot.use(startCommand);
    this.bot.use(helpCommand);
    this.bot.use(notesCommand);
    this.bot.use(archivedCommand);
    this.bot.use(linksCommand);
    this.bot.use(searchCommand);
    this.bot.use(glanceCommand);
    this.bot.use(suggestCommand);
    this.bot.use(classifyCommand);

    // Install modular handlers
    this.bot.use(callbackHandler);
    this.bot.use(messageHandler);
  }

  getBot(): Bot {
    return this.bot;
  }

  isAuthorizedUser(userId: number): boolean {
    return userId === config.telegram.userId;
  }

  async start(): Promise<void> {
    console.log('Starting Telepocket bot (modular architecture - Phase 1)...');

    // Set the menu button to open the Web App
    await this.bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Dashboard',
        web_app: { url: config.telegram.webAppUrl }
      }
    });
    console.log(`✅ Menu button set to: ${config.telegram.webAppUrl}`);

    await this.bot.start();
  }

  async stop(): Promise<void> {
    console.log('Stopping Telepocket bot...');
    await this.bot.stop();
  }
}

// Export singleton instance (maintains backward compatibility)
export const telegramClient = new ModularTelegramClient();
