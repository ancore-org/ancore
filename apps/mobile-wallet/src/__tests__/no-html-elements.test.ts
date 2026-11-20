import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Screens and components in this package render with React Native primitives, not HTML
 * (issues #1610, #1613, #1617). The unit tests run against a DOM-backed mock of
 * `react-native`, so they cannot tell a `<div>` from a `View`: this guard reads the source
 * to make sure no HTML tag creeps back into a converted file.
 */
const CONVERTED_FILES = [
  'screens/onboarding/VerifyMnemonicScreen.tsx',
  'screens/unlock/UnlockScreen.tsx',
  'components/PasswordFallbackForm.tsx',
  'components/HistoryError.tsx',
  'components/AttemptsIndicator.tsx',
  'components/BiometricLockoutBanner.tsx',
];

const HTML_TAGS = [
  'a',
  'article',
  'aside',
  'b',
  'br',
  'button',
  'div',
  'em',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'header',
  'hr',
  'i',
  'img',
  'input',
  'label',
  'li',
  'main',
  'nav',
  'ol',
  'option',
  'p',
  'section',
  'select',
  'small',
  'span',
  'strong',
  'table',
  'textarea',
  'ul',
];

const HTML_OPENING_TAG = new RegExp(`<(${HTML_TAGS.join('|')})(\\s|>|/)`);
// Comments and string literals may legitimately mention a tag name.
const withoutCommentsAndStrings = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

describe('converted screens and components', () => {
  it.each(CONVERTED_FILES)('%s contains no HTML elements', (file) => {
    const source = withoutCommentsAndStrings(readFileSync(join(__dirname, '..', file), 'utf8'));

    expect(source.match(HTML_OPENING_TAG)?.[0]).toBeUndefined();
  });

  it.each(CONVERTED_FILES)('%s imports its primitives from react-native', (file) => {
    const source = readFileSync(join(__dirname, '..', file), 'utf8');

    expect(source).toMatch(/from 'react-native'/);
  });

  it.each(CONVERTED_FILES)('%s uses no className or aria-* attributes', (file) => {
    const source = withoutCommentsAndStrings(readFileSync(join(__dirname, '..', file), 'utf8'));

    expect(source).not.toMatch(/\bclassName=/);
    expect(source).not.toMatch(/\baria-[a-z]+=/);
  });

  it('detects an HTML element when one is present (the guard itself works)', () => {
    const sample = withoutCommentsAndStrings('const x = <div className="a">hi</div>;');

    expect(sample.match(HTML_OPENING_TAG)?.[0]).toBe('<div ');
  });

  it('ignores tag names inside comments and strings', () => {
    const sample = withoutCommentsAndStrings(
      "// <div> is not allowed\nconst note = '<p>text</p>'; /* <span> */"
    );

    expect(sample.match(HTML_OPENING_TAG)).toBeNull();
  });
});
