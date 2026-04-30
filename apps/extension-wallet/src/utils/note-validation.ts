/**
 * Transfer Note Validation Utilities
 * 
 * Provides validation and truncation utilities for transfer notes
 * with a 140-character limit (similar to Twitter/X).
 */

export const MAX_NOTE_LENGTH = 140;

/**
 * Validates a transfer note against the 140-character limit
 * @param note - The note to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateTransferNote(note: string): string | undefined {
  const trimmedNote = note.trim();
  
  if (trimmedNote.length > MAX_NOTE_LENGTH) {
    return `Note must be ${MAX_NOTE_LENGTH} characters or less`;
  }
  
  return undefined;
}

/**
 * Truncates a note to fit within the 140-character limit
 * Adds ellipsis if truncation occurs
 * @param note - The note to truncate
 * @returns Truncated note (max 140 chars)
 */
export function truncateTransferNote(note: string): string {
  const trimmedNote = note.trim();
  
  if (trimmedNote.length <= MAX_NOTE_LENGTH) {
    return trimmedNote;
  }
  
  // Reserve space for ellipsis (3 chars)
  const maxLength = MAX_NOTE_LENGTH - 3;
  return trimmedNote.substring(0, maxLength) + '...';
}

/**
 * Calculates remaining characters for a note
 * @param note - The note to check
 * @returns Number of remaining characters
 */
export function getRemainingCharacters(note: string): number {
  return MAX_NOTE_LENGTH - note.trim().length;
}

/**
 * Sanitizes note text for safe rendering
 * Escapes HTML characters to prevent XSS
 * @param note - The note to sanitize
 * @returns Sanitized note safe for rendering
 */
export function sanitizeTransferNote(note: string): string {
  return note
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Checks if a note is empty or only whitespace
 * @param note - The note to check
 * @returns True if note is empty or whitespace only
 */
export function isNoteEmpty(note: string): boolean {
  return note.trim().length === 0;
}

/**
 * Formats note for display in preview
 * Combines sanitization and truncation
 * @param note - The note to format
 * @returns Formatted note safe for preview display
 */
export function formatNoteForPreview(note: string): string {
  const sanitized = sanitizeTransferNote(note);
  return truncateTransferNote(sanitized);
}
