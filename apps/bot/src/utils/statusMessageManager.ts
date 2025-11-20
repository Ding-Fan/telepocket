import { Context } from 'grammy';
import {
  StatusMessageOptions,
  StatusMessage as IStatusMessage,
  MessageOptions,
  OperationType,
  CompletionResult
} from '../types/statusMessage';
import { OPERATION_TEMPLATES } from './operationTemplates';

/**
 * Internal StatusMessage implementation
 * Manages the lifecycle of a single status message
 */
class StatusMessage implements IStatusMessage {
  private ctx: Context;
  private messageId: number | null = null;
  private operation: OperationType;
  private totalSteps: number | undefined;
  private currentStep: number = 0;
  private isShown: boolean = false;
  private isCompleted: boolean = false;
  private thresholdTimer: NodeJS.Timeout | null = null;
  private showAfterMs: number;
  private lastEditTime: number = 0;
  private readonly EDIT_DEBOUNCE_MS = 100; // Min 100ms between edits

  constructor(ctx: Context, options: StatusMessageOptions) {
    this.ctx = ctx;
    this.operation = options.operation;
    this.totalSteps = options.totalSteps;
    this.showAfterMs = options.showAfterMs ?? 500;
  }

  /**
   * Start the threshold timer
   * If operation takes longer than threshold, status message appears
   */
  startThresholdTimer(): void {
    this.thresholdTimer = setTimeout(async () => {
      await this.showStatusMessage();
    }, this.showAfterMs);
  }

  /**
   * Show the initial status message
   */
  private async showStatusMessage(): Promise<void> {
    // Check if operation already completed to prevent race condition
    if (this.isCompleted) {
      return;
    }

    try {
      const template = OPERATION_TEMPLATES[this.operation];
      const message = this.buildMessage(template.message);

      // Send chat action
      await this.ctx.replyWithChatAction(template.chatAction);

      // Send status message
      const sentMessage = await this.ctx.reply(message);
      this.messageId = sentMessage.message_id;
      this.isShown = true;
    } catch (error) {
      console.error('Failed to show status message:', error);
      // Silent fallback - operation continues
    }
  }

  /**
   * Build message with progress indicator if applicable
   */
  private buildMessage(baseMessage: string): string {
    if (this.totalSteps && this.currentStep > 0) {
      return `${baseMessage} (${this.currentStep}/${this.totalSteps})`;
    }
    return baseMessage;
  }

  /**
   * Update the status message with new progress
   */
  async update(currentStep?: number): Promise<void> {
    if (currentStep !== undefined) {
      this.currentStep = currentStep;
    } else {
      this.currentStep++;
    }

    // Only update if status is shown
    if (!this.isShown || this.messageId === null) {
      return;
    }

    // Debounce rapid updates to respect rate limits
    const now = Date.now();
    if (now - this.lastEditTime < this.EDIT_DEBOUNCE_MS) {
      return;
    }

    try {
      const template = OPERATION_TEMPLATES[this.operation];
      const message = this.buildMessage(template.message);

      // Send chat action refresh
      await this.ctx.replyWithChatAction(template.chatAction);

      // Edit the message
      await this.ctx.api.editMessageText(
        this.ctx.chat!.id,
        this.messageId,
        message
      );

      this.lastEditTime = now;
    } catch (error: any) {
      // Handle "message not modified" error silently
      if (error?.error_code === 400 && error?.description?.includes('message is not modified')) {
        return;
      }

      // Handle rate limit errors
      if (error?.error_code === 429) {
        console.warn('Rate limit hit while updating status, skipping update');
        return;
      }

      console.error('Failed to update status message:', error);
      // Silent fallback - operation continues
    }
  }

  /**
   * Complete the operation and show final message
   * Returns the final message ID for follow-up operations (e.g., adding buttons)
   */
  async complete(finalMessage: string, options?: MessageOptions): Promise<{ messageId: number | null }> {
    // Set completion flag first to prevent race condition with threshold timer
    this.isCompleted = true;

    // Cancel threshold timer if still pending
    if (this.thresholdTimer) {
      clearTimeout(this.thresholdTimer);
      this.thresholdTimer = null;
    }

    let finalMessageId: number | null = null;

    try {
      if (this.isShown && this.messageId !== null) {
        // Edit existing status message to final result
        await this.ctx.api.editMessageText(
          this.ctx.chat!.id,
          this.messageId,
          finalMessage,
          options
        );
        finalMessageId = this.messageId;
      } else {
        // Operation completed before threshold - send final message directly
        const sentMessage = await this.ctx.reply(finalMessage, options);
        finalMessageId = sentMessage.message_id;
      }
    } catch (error: any) {
      // Handle "message not modified" error
      if (error?.error_code === 400 && error?.description?.includes('message is not modified')) {
        // Message already shows the final content, that's fine
        finalMessageId = this.messageId;
        return { messageId: finalMessageId };
      }

      console.error('Failed to complete status message:', error);

      // Fallback: try to send as new message if edit failed
      try {
        if (this.isShown) {
          const fallbackMessage = await this.ctx.reply(finalMessage, options);
          finalMessageId = fallbackMessage.message_id;
        }
      } catch (fallbackError) {
        console.error('Fallback message also failed:', fallbackError);
      }
    } finally {
      // Cleanup
      this.cleanup();
    }

    return { messageId: finalMessageId };
  }

  /**
   * Cancel the status message without showing final result
   */
  async cancel(): Promise<void> {
    // Set completion flag first to prevent race condition with threshold timer
    this.isCompleted = true;

    if (this.thresholdTimer) {
      clearTimeout(this.thresholdTimer);
      this.thresholdTimer = null;
    }

    // Optionally delete the status message
    if (this.isShown && this.messageId !== null) {
      try {
        await this.ctx.api.deleteMessage(this.ctx.chat!.id, this.messageId);
      } catch (error) {
        console.error('Failed to delete status message:', error);
      }
    }

    this.cleanup();
  }

  /**
   * Cleanup internal state
   */
  private cleanup(): void {
    this.messageId = null;
    this.isShown = false;
    this.thresholdTimer = null;
  }
}

/**
 * StatusMessageManager - Factory for creating status messages
 *
 * Usage:
 * ```typescript
 * const status = await StatusMessageManager.start(ctx, {
 *   operation: 'processing_note',
 *   totalSteps: 3
 * });
 *
 * await status.update(1);
 * await performStep1();
 *
 * await status.update(2);
 * await performStep2();
 *
 * await status.complete('✅ Done!');
 * ```
 */
export class StatusMessageManager {
  /**
   * Start a new status message operation
   * Returns a StatusMessage handle for updates and completion
   */
  static async start(
    ctx: Context,
    options: StatusMessageOptions
  ): Promise<IStatusMessage> {
    const statusMessage = new StatusMessage(ctx, options);
    statusMessage.startThresholdTimer();
    return statusMessage;
  }
}
