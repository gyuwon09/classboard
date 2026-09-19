import katex from 'katex';

export type MathPart = { text: string; latex?: string; display?: boolean };
/** Only explicit math delimiters are interpreted; prose and unmatched delimiters stay text. */
export function splitChatMath(text: string): MathPart[] {
  const expression = /(?<!\\)(?:\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$)/g;
  const parts: MathPart[] = [];
  let offset = 0;
  for (const match of text.matchAll(expression)) {
    const start = match.index!;
    if (start > offset) parts.push({ text: text.slice(offset, start) });
    const latex = match[1] ?? match[2] ?? match[3] ?? match[4];
    // A pair of prices such as "$20 and $30" is not a formula.
    const price = match[4] !== undefined && /^\d/.test(latex) && /\s(?:and|or)\s/.test(latex);
    parts.push(price ? { text: match[0] } : { text: match[0], latex, display: match[1] !== undefined || match[2] !== undefined });
    offset = start + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}
export function renderChatMath(latex: string, display: boolean) {
  try {
    return katex.renderToString(latex, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', maxExpand: 200, maxSize: 10, output: 'htmlAndMathml' });
  } catch { return null; }
}
