import { boardInputSchema, generateBoard } from '@/lib/agent';
import { apiConfig, rejectUnauthorised } from '@/lib/server-config';
export async function POST(request: Request) {
  const rejected = await rejectUnauthorised(request);
  if (rejected) return rejected;
  const config = apiConfig();
  if (!config.apiKey) return Response.json({ error: 'AI 연결이 설정되지 않았습니다. 서버의 API 키 설정을 확인해 주세요.' }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 180000) return Response.json({ error: '자료가 너무 큽니다. 수업 범위를 줄여 주세요.' }, { status: 413 });
    const parsed = boardInputSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return Response.json({ error: '설명과 자료 범위를 확인해 주세요. 최대 20쪽, 50,000자까지 사용할 수 있습니다.' }, { status: 400 });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90000)]);
    const frame = await generateBoard(parsed.data, { ...config, signal });
    return Response.json({ frame }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return Response.json({ error: timedOut ? '요청이 중단되었거나 시간이 초과되었습니다. 다시 시도해 주세요.' : error instanceof Error ? error.message : '판서를 만들지 못했습니다.' }, { status: timedOut ? 504 : 502 });
  }
}
