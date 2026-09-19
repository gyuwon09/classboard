import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfTextProblem } from '../lib/pdf-text-quality.ts';
import { ocrInputSchema, readPageImage } from '../lib/pdf-ocr.ts';

test('font-map corruption from the reported Korean textbook triggers image reading', () => {
  const broken = 'ள̛ Մ਺Ϲࠋ ଓ ࡯яࠓӷП ȯϝ଑ࢯ ܵĔ ߇ࠥ଑ʼ ̷ ளࠋ ଘВ߻ ૏ଦ، Տ୎Լ߽ ੝ଝ ܷ چ ࠞ˜ ૏ଦ،Տ୎Լ߸П Šଓ ଘВࠓ ࡔں ଘВĿ ࠗগ଑ʼ';
  assert.equal(pdfTextProblem(broken), 'encoding');
  assert.equal(pdfTextProblem('교과서\u0001본문\u0001단원\u0001설명입니다.'), 'encoding');
  assert.equal(pdfTextProblem('□□□□□□□□\ufffd\ufffd\ufffd'), 'encoding');
});
test('normal Korean, math, and foreign-language text are not mistaken for corruption', () => {
  for (const text of ['힘은 크기와 방향을 가진 벡터이다. F = ma, θ = 30°, 3.00 N', 'K = 1/2 mv², ΔE = 0, α + β = γ, ∫ x dx', 'Force has magnitude and direction. Mass is measured in kg.', 'Сила имеет величину и направление.', 'これは力と運動についての学習資料です。', 'القوة لها مقدار واتجاه.']) assert.equal(pdfTextProblem(text), null, text);
  assert.equal(pdfTextProblem('   \n'), 'empty');
});
const image = 'data:image/jpeg;base64,/9j/AA==';
const packet = text => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ text, uncertain: false }) }] }] });
test('OCR reads only the page image with structured output and no server persistence', async () => {
  let sent;
  const result = await readPageImage(image, { apiKey: 'test', model: 'test', fetcher: async (_url, request) => { sent = JSON.parse(request.body); return Response.json(packet('힘은 크기와 방향을 가진다.')); } });
  assert.equal(result.text, '힘은 크기와 방향을 가진다.');
  assert.equal(sent.store, false);
  assert.equal(sent.input[0].content[1].image_url, image);
  assert.equal(sent.text.format.strict, true);
  assert.match(sent.instructions, /추측은 하지 않는다/);
});
test('truncated, refused, oversized, malformed and failed OCR are rejected', async () => {
  for (const response of [{ status: 'incomplete' }, { status: 'completed', output: [] }, packet('가'.repeat(8001))]) {
    await assert.rejects(readPageImage(image, { apiKey: 'test', model: 'test', fetcher: async () => Response.json(response) }));
  }
  await assert.rejects(readPageImage(image, { apiKey: 'test', model: 'test', fetcher: async () => new Response('', { status: 429 }) }), /사용 한도/);
});
test('OCR accepts inline JPEG pages only, not external URLs or excessive page ranges', () => {
  assert.equal(ocrInputSchema.safeParse({ page: 1, image }).success, true);
  assert.equal(ocrInputSchema.safeParse({ page: 21, image }).success, false);
  assert.equal(ocrInputSchema.safeParse({ page: 1, image: 'https://example.com/private.jpg' }).success, false);
});
