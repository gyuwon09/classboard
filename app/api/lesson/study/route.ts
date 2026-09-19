import { studyInputSchema, runStudy } from '@/lib/lesson-study';
import { apiConfig, rejectUnauthorised } from '@/lib/server-config';
export async function POST(request: Request) {
  const rejected=await rejectUnauthorised(request); if(rejected)return rejected;
  const config=apiConfig(); if(!config.apiKey)return Response.json({error:'AI 연결 설정이 필요합니다.'},{status:503});
  try {
    const body=await request.text();if(body.length>4000000)return Response.json({error:'수업 기록이 너무 큽니다.'},{status:413});
    const parsed=studyInputSchema.safeParse(JSON.parse(body));if(!parsed.success)return Response.json({error:'수업 기록 또는 질문 형식을 확인해 주세요.'},{status:400});
    const result=await runStudy(parsed.data,{...config,signal:AbortSignal.any([request.signal,AbortSignal.timeout(90000)])});
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return Response.json({error:error instanceof Error && ['AbortError','TimeoutError'].includes(error.name)?'응답 시간이 초과되었습니다. 다시 시도해 주세요.':error instanceof Error && error.name!=='ZodError' && error.name!=='SyntaxError'?error.message:'응답 형식을 확인하지 못했습니다. 다시 시도해 주세요.'},{status:502});}
}
