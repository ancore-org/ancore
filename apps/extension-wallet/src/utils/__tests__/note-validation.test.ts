import {
  validateTransferNote,
  truncateTransferNote,
  getRemainingCharacters,
  sanitizeTransferNote,
  isNoteEmpty,
  formatNoteForPreview,
  MAX_NOTE_LENGTH,
} from '../note-validation';

describe('Note Validation Utilities', () => {
  describe('validateTransferNote', () => {
    it('should accept valid notes within limit', () => {
      const validNote = 'This is a valid note';
      expect(validateTransferNote(validNote)).toBeUndefined();
    });

    it('should accept empty notes', () => {
      expect(validateTransferNote('')).toBeUndefined();
      expect(validateTransferNote('   ')).toBeUndefined();
    });

    it('should accept notes exactly at the limit', () => {
      const exactNote = 'a'.repeat(MAX_NOTE_LENGTH);
      expect(validateTransferNote(exactNote)).toBeUndefined();
    });

    it('should reject notes over the limit', () => {
      const longNote = 'a'.repeat(MAX_NOTE_LENGTH + 1);
      expect(validateTransferNote(longNote)).toBe(
        `Note must be ${MAX_NOTE_LENGTH} characters or less`
      );
    });

    it('should handle whitespace correctly', () => {
      const noteWithSpaces = '  '.repeat(70); // 140 characters
      expect(validateTransferNote(noteWithSpaces)).toBeUndefined();

      const noteWithExtraSpaces = '  '.repeat(71); // 142 characters
      expect(validateTransferNote(noteWithExtraSpaces)).toBe(
        `Note must be ${MAX_NOTE_LENGTH} characters or less`
      );
    });
  });

  describe('truncateTransferNote', () => {
    it('should return unchanged notes within limit', () => {
      const shortNote = 'Short note';
      expect(truncateTransferNote(shortNote)).toBe(shortNote);
    });

    it('should trim whitespace before checking length', () => {
      const noteWithSpaces = '  Short note  ';
      expect(truncateTransferNote(noteWithSpaces)).toBe('Short note');
    });

    it('should truncate notes over the limit with ellipsis', () => {
      const longNote = 'a'.repeat(MAX_NOTE_LENGTH + 10);
      const result = truncateTransferNote(longNote);
      expect(result).toBe('a'.repeat(MAX_NOTE_LENGTH - 3) + '...');
      expect(result.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH);
    });

    it('should handle empty notes', () => {
      expect(truncateTransferNote('')).toBe('');
      expect(truncateTransferNote('   ')).toBe('');
    });

    it('should preserve content when truncating', () => {
      const longNote =
        'This is a very long note that should be truncated '.repeat(5) + 'with extra content';
      const result = truncateTransferNote(longNote);
      expect(result).toContain('This is a very long note that should be trunc');
      expect(result).toMatch(/\.\.\.$/);
    });
  });

  describe('getRemainingCharacters', () => {
    it('should return correct remaining characters', () => {
      expect(getRemainingCharacters('')).toBe(MAX_NOTE_LENGTH);
      expect(getRemainingCharacters('short')).toBe(MAX_NOTE_LENGTH - 5);
      expect(getRemainingCharacters('a'.repeat(100))).toBe(MAX_NOTE_LENGTH - 100);
    });

    it('should return negative for over-limit notes', () => {
      expect(getRemainingCharacters('a'.repeat(MAX_NOTE_LENGTH + 5))).toBe(-5);
    });

    it('should handle whitespace correctly', () => {
      expect(getRemainingCharacters('   ')).toBe(MAX_NOTE_LENGTH);
      expect(getRemainingCharacters('  hello  ')).toBe(MAX_NOTE_LENGTH - 5);
    });
  });

  describe('sanitizeTransferNote', () => {
    it('should escape HTML characters', () => {
      const maliciousNote = '<script>alert("xss")</script>';
      const sanitized = sanitizeTransferNote(maliciousNote);
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should handle mixed content', () => {
      const mixedNote = 'Hello <b>world</b> & "friends"';
      const sanitized = sanitizeTransferNote(mixedNote);
      expect(sanitized).toBe('Hello &lt;b&gt;world&lt;/b&gt; &amp; &quot;friends&quot;');
    });

    it('should preserve safe content', () => {
      const safeNote = 'This is a safe note with emojis 😊 and symbols @#$%';
      expect(sanitizeTransferNote(safeNote)).toBe(safeNote);
    });

    it('should handle empty strings', () => {
      expect(sanitizeTransferNote('')).toBe('');
      expect(sanitizeTransferNote('   ')).toBe('   ');
    });
  });

  describe('isNoteEmpty', () => {
    it('should identify empty strings', () => {
      expect(isNoteEmpty('')).toBe(true);
      expect(isNoteEmpty('   ')).toBe(true);
      expect(isNoteEmpty('\t\n')).toBe(true);
    });

    it('should identify non-empty strings', () => {
      expect(isNoteEmpty('hello')).toBe(false);
      expect(isNoteEmpty('  hello  ')).toBe(false);
      expect(isNoteEmpty('a')).toBe(false);
    });
  });

  describe('formatNoteForPreview', () => {
    it('should combine sanitization and truncation', () => {
      const maliciousLongNote = '<script>'.repeat(30) + 'content';
      const result = formatNoteForPreview(maliciousLongNote);

      // Should be sanitized
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');

      // Should be truncated
      expect(result.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH);
    });

    it('should handle safe short notes', () => {
      const safeNote = 'This is a safe note';
      const result = formatNoteForPreview(safeNote);
      expect(result).toBe(safeNote);
    });

    it('should handle empty notes', () => {
      expect(formatNoteForPreview('')).toBe('');
      expect(formatNoteForPreview('   ')).toBe('');
    });

    it('should preserve line breaks in safe content', () => {
      const noteWithLines = 'Line 1\nLine 2\nLine 3';
      const result = formatNoteForPreview(noteWithLines);
      expect(result).toBe(noteWithLines);
    });
  });

  describe('MAX_NOTE_LENGTH constant', () => {
    it('should be 140', () => {
      expect(MAX_NOTE_LENGTH).toBe(140);
    });
  });

  describe('Edge cases', () => {
    it('should handle Unicode characters correctly', () => {
      const unicodeNote = '😀😃😄😁😆😅😂🤣😊😇'.repeat(14); // 140 characters
      expect(validateTransferNote(unicodeNote)).toBeUndefined();

      const unicodeNoteOver = unicodeNote + '😀';
      expect(validateTransferNote(unicodeNoteOver)).toBe(
        `Note must be ${MAX_NOTE_LENGTH} characters or less`
      );
    });

    it('should handle very long strings efficiently', () => {
      const veryLongNote = 'a'.repeat(10000);
      const result = truncateTransferNote(veryLongNote);
      expect(result.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should handle null/undefined inputs gracefully', () => {
      // These should not throw errors
      expect(() => validateTransferNote(null as any)).not.toThrow();
      expect(() => validateTransferNote(undefined as any)).not.toThrow();
      expect(() => truncateTransferNote(null as any)).not.toThrow();
      expect(() => truncateTransferNote(undefined as any)).not.toThrow();
    });
  });
});
