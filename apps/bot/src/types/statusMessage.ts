import { Context } from 'grammy';

export type OperationType =
  | 'extracting_links'
  | 'fetching_metadata'
  | 'uploading_image'
  | 'classifying_note'
  | 'searching_notes'
  | 'processing_note';

export interface StatusMessageOptions {
  showAfterMs?: number; // Default: 500ms
  operation: OperationType;
  totalSteps?: number; // For progress tracking
}

export interface MessageOptions {
  parse_mode?: 'MarkdownV2' | 'Markdown' | 'HTML';
  reply_markup?: any;
}

export interface CompletionResult {
  messageId: number | null; // null if message wasn't shown (operation completed too quickly)
}

export interface StatusMessage {
  update(currentStep?: number): Promise<void>;
  complete(finalMessage: string, options?: MessageOptions): Promise<CompletionResult>;
  cancel(): Promise<void>;
}

export interface OperationTemplate {
  message: string;
  chatAction: 'typing' | 'upload_photo' | 'upload_video' | 'upload_document';
}
