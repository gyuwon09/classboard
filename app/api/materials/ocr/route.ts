import { apiConfig, rejectUnauthorised } from '@/lib/server-config';
import { ocrInputSchema, readPageImage } from '@/lib/pdf-ocr';

export async function POST(request: Request) {
  const rejected = await rejectUnauthorised(request);
  if (rejected) return rejected;
  const config = apiConfig();
  if (!config.apiKey) return Response.json({ error: '깨진 PDF를 이미지로 읽으려면 서버의 API 키 설정이 필요합니다.' }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 8_001_000) return Response.json({ error: '페이지 이미지가 너무 큽니다. 자료를 나누어 주세요.' }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(body); } catch { return Response.json({ error: '페이지 요청 형식이 올바르지 않습니다.' }, { status: 400 }); }
    const parsed = ocrInputSchema.safeParse(input);
    if (!parsed.success) return Response.json({ error: '페이지 이미지 형식이 올바르지 않습니다.' }, { status: 400 });
    const result = await readPageImage(parsed.data.image, { apiKey: config.apiKey, model: config.ocrModel, signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]) });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return Response.json({ error: timeout ? '페이지 인식 시간이 초과되거나 취소되었습니다. 다시 시도해 주세요.' : error instanceof Error ? error.message : '페이지를 읽지 못했습니다.' }, { status: timeout ? 504 : 502 });
  }
}
