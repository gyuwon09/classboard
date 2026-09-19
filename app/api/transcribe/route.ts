import { apiConfig, rejectUnauthorised } from '@/lib/server-config';
export async function POST(request: Request) {
  const rejected = await rejectUnauthorised(request);
  if (rejected) return rejected;
  const config = apiConfig();
  if (!config.apiKey) return Response.json({ error: '음성 인식 연결이 설정되지 않았습니다. 텍스트를 직접 입력할 수 있습니다.' }, { status: 503 });
  try {
    if (Number(request.headers.get('content-length')) > 12 * 1024 * 1024) return Response.json({ error: '녹음이 너무 큽니다. 30초 이하로 나누어 주세요.' }, { status: 413 });
    const incoming = await request.formData();
    const audio = incoming.get('audio');
    if (!(audio instanceof File) || !audio.size || audio.size > 10 * 1024 * 1024 || !/^(audio\/(webm|ogg|mp4|mpeg|wav|x-wav)|video\/webm)/.test(audio.type)) return Response.json({ error: '지원하는 음성 파일이 아닙니다.' }, { status: 400 });
    const data = new FormData();
    data.append('file', audio, audio.name);
    data.append('model', config.transcriptionModel);
    data.append('language', 'ko');
    data.append('response_format', 'json');
    data.append('prompt', '학교 수업. 지구 탈출 속도, 운동 에너지, 중력 퍼텐셜 에너지, 에너지 보존, 질량, 반지름, 킬로미터 매 초.');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: data, signal: AbortSignal.any([request.signal, AbortSignal.timeout(35000)]) });
    if (!response.ok) return Response.json({ error: response.status === 429 ? '음성 인식 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' : '음성을 인식하지 못했습니다. 다시 녹음하거나 직접 입력해 주세요.' }, { status: 502 });
    const result = await response.json() as { text?: string };
    if (!result.text?.trim()) return Response.json({ error: '인식된 음성이 없습니다. 마이크와 주변 소음을 확인해 주세요.' }, { status: 422 });
    return Response.json({ text: result.text.slice(0, 2000) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: '음성 인식이 중단되었습니다. 다시 시도하거나 텍스트를 입력해 주세요.' }, { status: 504 }); }
}
