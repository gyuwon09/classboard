import { z } from 'zod';
export const correctionSchema = z.object({ from: z.string().min(1).max(30), to: z.string().min(1).max(30), evidenceId: z.string().min(1).max(40) }).strict();
export const recognitionSchema = z.object({ original: z.string().max(2000), corrected: z.string().max(2400), changes: z.array(z.object({ from: z.string(), to: z.string(), page: z.number().int(), quote: z.string() }).strict()).max(8) }).strict();
export const correctionsJsonSchema = { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, properties: { from: { type: 'string', minLength: 1, maxLength: 30 }, to: { type: 'string', minLength: 1, maxLength: 30 }, evidenceId: { type: 'string', minLength: 1, maxLength: 40 } }, required: ['from', 'to', 'evidenceId'] } };
const compact = (text: string) => text.normalize('NFKC').replace(/\s/g, '');
// Corrections may fix vocabulary, but must not turn an incorrect scientific statement into a correct one.
const protectedMeaning = /\d|[=<>+−]|아래|위쪽|위로|왼쪽|오른쪽|없|아니|않|증가|감소|일정|두\s*배|절반/;
const unitTokens = (text: string) => text.match(/(?<![A-Za-z])(?:kg|mg|km|cm|mm|ms|m|g|s|N|J|W|Pa|Hz)(?![A-Za-z])|킬로그램|밀리그램|킬로미터|센티미터|밀리미터|미터|그램|뉴턴|파스칼|헤르츠/g)?.join('|') ?? '';
export function normalizeRecognition(original: string, corrections: z.infer<typeof correctionSchema>[], evidence: { id: string; page: number; quote: string }[]) {
  const ranges: { start: number; end: number; text: string }[] = [];
  const changes: z.infer<typeof recognitionSchema>['changes'] = [];
  for (const correction of corrections) {
    if (correction.from === correction.to) continue;
    const source = evidence.find(item => item.id === correction.evidenceId);
    if (!source || !compact(source.quote).includes(compact(correction.to)) || protectedMeaning.test(correction.from) || protectedMeaning.test(correction.to) || unitTokens(correction.from) !== unitTokens(correction.to)) throw Error('보정할 용어의 교재 근거가 불명확합니다. 정확한 용어를 다시 말하거나 직접 입력해 주세요.');
    let start = original.indexOf(correction.from), found = false;
    while (start >= 0) {
      const end = start + correction.from.length;
      if (ranges.some(range => start < range.end && end > range.start)) throw Error('음성 보정 후보가 겹칩니다. 용어를 다시 확인해 주세요.');
      ranges.push({ start, end, text: correction.to }); found = true;
      start = original.indexOf(correction.from, end);
    }
    if (!found) throw Error('보정 대상이 인식 원문과 일치하지 않습니다.');
    changes.push({ from: correction.from, to: correction.to, page: source.page, quote: source.quote });
  }
  let corrected = original;
  for (const range of ranges.sort((a, b) => b.start - a.start)) corrected = corrected.slice(0, range.start) + range.text + corrected.slice(range.end);
  if (corrected.length > 2400) throw Error('보정한 설명이 너무 깁니다. 짧게 나누어 설명해 주세요.');
  return { original, corrected, changes };
}
