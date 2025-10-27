/**
 * Error context for logging
 */
export interface ErrorContext {
  userId?: number;
  operation: string;
  timestamp: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Standardized error handler with context logging
 * @param error - The error object
 * @param context - Error context information
 * @returns User-friendly error message
 */
export function handleDatabaseError(error: unknown, context: ErrorContext): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  console.error('Database operation failed:', {
    ...context,
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined
  });

  // Return user-friendly message based on operation type
  const operationMessages: Record<string, string> = {
    'saveNote': 'Failed to save your note. Please try again.',
    'saveNoteLinks': 'Failed to save note links. Please try again.',
    'saveNoteWithLinks': 'Failed to save your note. Please try again.',
    'getNotesWithPagination': 'Failed to fetch your notes. Please try again.',
    'searchNotesWithPagination': 'Failed to search your notes. Please try again.',
    'getLinksWithPagination': 'Failed to fetch your links. Please try again.',
    'searchLinksWithPagination': 'Failed to search your links. Please try again.',
  };

  return operationMessages[context.operation] || 'An error occurred. Please try again.';
}

/**
 * Handles validation errors with context
 * @param validationError - The validation error message
 * @param context - Error context information
 * @returns User-friendly error message
 */
export function handleValidationError(validationError: string, context: ErrorContext): string {
  console.warn('Validation failed:', {
    ...context,
    validationError
  });

  return `❌ ${validationError}`;
}

/**
 * Handles general command errors
 * @param error - The error object
 * @param context - Error context information
 * @returns User-friendly error message
 */
export function handleCommandError(error: unknown, context: ErrorContext): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  console.error('Command execution failed:', {
    ...context,
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined
  });

  return '❌ Sorry, there was an error processing your command. Please try again in a moment.';
}
