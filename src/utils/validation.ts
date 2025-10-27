import { config } from '../config/environment';

/**
 * Validation constants
 */
export const VALIDATION_LIMITS = {
  NOTE_CONTENT_MAX_LENGTH: 4000,
  SEARCH_KEYWORD_MAX_LENGTH: 100,
  SEARCH_KEYWORD_MIN_LENGTH: 1,
} as const;

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that the user ID matches the authorized user
 * @param userId - The user ID to validate
 * @returns Validation result
 */
export function validateAuthorizedUser(userId: number): ValidationResult {
  const authorizedUserId = config.telegram.userId;

  if (userId !== authorizedUserId) {
    return {
      valid: false,
      error: `Unauthorized user ID: ${userId}. Expected: ${authorizedUserId}`
    };
  }

  return { valid: true };
}

/**
 * Validates note content
 * @param content - The note content to validate
 * @returns Validation result
 */
export function validateNoteContent(content: string): ValidationResult {
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      error: 'Note content cannot be empty'
    };
  }

  if (content.length > VALIDATION_LIMITS.NOTE_CONTENT_MAX_LENGTH) {
    return {
      valid: false,
      error: `Note content too long (max ${VALIDATION_LIMITS.NOTE_CONTENT_MAX_LENGTH} characters)`
    };
  }

  return { valid: true };
}

/**
 * Validates search keyword
 * @param keyword - The search keyword to validate
 * @returns Validation result
 */
export function validateSearchKeyword(keyword: string): ValidationResult {
  if (!keyword || keyword.trim().length === 0) {
    return {
      valid: false,
      error: 'Search keyword cannot be empty'
    };
  }

  if (keyword.trim().length < VALIDATION_LIMITS.SEARCH_KEYWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Search keyword too short (min ${VALIDATION_LIMITS.SEARCH_KEYWORD_MIN_LENGTH} character)`
    };
  }

  if (keyword.length > VALIDATION_LIMITS.SEARCH_KEYWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Search keyword too long (max ${VALIDATION_LIMITS.SEARCH_KEYWORD_MAX_LENGTH} characters)`
    };
  }

  return { valid: true };
}

/**
 * Validates pagination parameters
 * @param page - Page number
 * @param limit - Items per page
 * @returns Validation result
 */
export function validatePagination(page: number, limit: number): ValidationResult {
  if (page < 1) {
    return {
      valid: false,
      error: 'Page number must be at least 1'
    };
  }

  if (limit < 1 || limit > 50) {
    return {
      valid: false,
      error: 'Limit must be between 1 and 50'
    };
  }

  return { valid: true };
}
