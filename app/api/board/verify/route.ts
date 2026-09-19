import { z } from 'zod';
import { boardFrameSchema, sourcePageSchema, validateGrounding } from '@/lib/agent';
import { verifyBoard } from '@/lib/board-verification';
import { apiConfig, rejectUnauthorised } from '@/lib/server-config';

const editSchema = z.object({
  frame: boardFrameSchema.omit({ verification: true }),
  pages: z.array(sourcePageSchema).min(1).max(20),
}).strict().refine(value => value.pages.reduce((sum, page) => sum + page.text.length, 0) <= 50000);
export async function POST(request: Request) {
  const rejected = await rejectUnauthorised(request);
  if (rejected) return rejected;
  const config = apiConfig();
  if (!config.apiKey) return Response.json({ error: '검증 연결이 설정되지 않았습니다.' }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 180000) return Response.json({ error: '검증할 자료가 너무 큽니다.' }, { status: 413 });
    const input = editSchema.safeParse(JSON.parse(body));
    if (!input.success || input.data.frame.action !== 'ready') return Response.json({ error: '수정할 판서와 교재를 확인해 주세요.' }, { status: 400 });
    const candidate = validateGrounding(input.data.frame, input.data.pages);
    const frame = await verifyBoard(candidate, input.data.pages, candidate.title, { ...config, signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]) });
    return Response.json({ frame }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '수정 내용의 검증을 완료하지 못했습니다. 기존 판서는 유지됩니다.' }, { status: 502 });
  }
}
