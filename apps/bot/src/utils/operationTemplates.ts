import { OperationType, OperationTemplate } from '../types/statusMessage';

export const OPERATION_TEMPLATES: Record<OperationType, OperationTemplate> = {
  extracting_links: {
    message: '🔗 Extracting links...',
    chatAction: 'typing'
  },
  fetching_metadata: {
    message: '📄 Fetching metadata...',
    chatAction: 'typing'
  },
  uploading_image: {
    message: '📤 Uploading image...',
    chatAction: 'upload_photo'
  },
  classifying_note: {
    message: '🤖 Classifying note...',
    chatAction: 'typing'
  },
  searching_notes: {
    message: '🔍 Searching notes...',
    chatAction: 'typing'
  },
  processing_note: {
    message: '⚙️ Processing...',
    chatAction: 'typing'
  }
};
