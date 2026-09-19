import { apiConfig, rejectUnauthorised } from '@/lib/server-config';
export async function POST(request: Request) {
  const rejected = await rejectUnauthorised(request);
  if (rejected) return rejected;
  const { apiKey } = apiConfig();
  if (!apiKey) return Response.json({ error: '음성 인식 API 설정을 확인해 주세요.' }, { status: 503 });
  try {
    const sdp = await request.text();
    if (sdp.length > 64000 || !sdp.startsWith('v=0')) return Response.json({ error: '음성 연결 요청이 올바르지 않습니다.' }, { status: 400 });
    const form = new FormData();
    form.set('sdp', sdp);
    form.set('session', JSON.stringify({ type: 'transcription', audio: { input: { transcription: { model: 'gpt-live-transcribe', languages: ['ko'], delay: 'low' }, turn_detection: null } } }));
    const response = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]) });
    if (!response.ok) return Response.json({ error: response.status === 429 ? '음성 인식 사용 한도에 도달했습니다. 잠시 후 다시 연결해 주세요.' : '실시간 음성에 연결하지 못했습니다. API 접근 권한과 네트워크를 확인하거나 직접 입력을 사용해 주세요.' }, { status: 502 });
    return new Response(await response.text(), { headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: '음성 연결이 중단되었습니다. 다시 연결해 주세요.' }, { status: 504 }); }
}
