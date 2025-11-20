import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { handlePhotoMessage } from '../noteHandlers';

export const messageHandler = new Composer();

/**
 * Photo message handler - processes photo messages
 */
messageHandler.on('message:photo', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    return;
  }

  await handlePhotoMessage(ctx);
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}
