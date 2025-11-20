import { Keyboard } from 'grammy';

/**
 * Create the main persistent keyboard with "My Notes" button
 */
export function createMainKeyboard() {
  return new Keyboard()
    .text('📋 My Notes')
    .resized()
    .persistent();
}
