/** Detect damaged PDF character maps; never try to translate the damaged text. */
export function pdfTextProblem(text: string): 'empty' | 'encoding' | null {
  const visible = text.replace(/\s/g, '');
  if (visible.length < 8) return 'empty';
  const damaged = (text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd\ue000-\uf8ff]/g) ?? []).length;
  if (damaged >= 3 || damaged / visible.length > 0.02) return 'encoding';
  // Korean textbook font-map failures often scatter letters across unrelated scripts.
  // Count script diversity rather than treating every non-Korean language as broken.
  const scripts = ['Hangul', 'Latin', 'Han', 'Hiragana', 'Katakana', 'Greek', 'Cyrillic', 'Armenian', 'Hebrew', 'Arabic', 'Syriac', 'Thaana', 'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Thai', 'Lao'];
  const counts = scripts.map(script => (text.match(new RegExp(`\\p{Script=${script}}`, 'gu')) ?? []).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const significant = counts.filter(count => count >= Math.max(3, total * 0.03));
  if (total >= 20 && significant.length >= 5 && Math.max(...counts) / total < 0.7) return 'encoding';
  return null;
}
