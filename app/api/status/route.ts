import { getChatGPTUser } from '@/app/chatgpt-auth';
import { apiConfig } from '@/lib/server-config';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({ authenticated: !!user, configured: !!apiConfig().apiKey }, { headers: { 'Cache-Control': 'no-store' } });
}
