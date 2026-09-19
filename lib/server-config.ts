import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export function apiConfig() {
  const values = env as unknown as Record<string, string | undefined>;
  return { verificationModel: values.OPENAI_VERIFICATION_MODEL || process.env.OPENAI_VERIFICATION_MODEL || 'gpt-4.1', ocrModel: values.OPENAI_OCR_MODEL || process.env.OPENAI_OCR_MODEL || 'gpt-4.1', apiKey: values.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '', model: values.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini', transcriptionModel: values.OPENAI_TRANSCRIBE_MODEL || process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe' };
}
export async function rejectUnauthorised(request: Request): Promise<Response | null> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않는 요청입니다.' }, { status: 403 });
  if (!await getChatGPTUser()) return Response.json({ error: '실시간 AI 기능을 사용하려면 로그인해 주세요.', signIn: '/signin-with-chatgpt?return_to=/' }, { status: 401 });
  return null;
}
