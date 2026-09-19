import test from 'node:test';
import assert from 'node:assert/strict';
import {runStudy,studyInputSchema,studyEvidence} from '../lib/lesson-study.ts';
import {savedLessonSchema} from '../lib/lesson-archive.ts';
import {output} from './verification-fixture.mjs';
const lesson={source:{name:'수직항력',pages:[{page:1,text:'수평 지면 위 물체의 수직항력은 위쪽으로 작용한다.'}]},frames:[],transcript:['수직항녁은 위로 작용한다.'],notices:[],startedAt:1,endedAt:2};
const options=fetcher=>({apiKey:'test',model:'test',fetcher});
test('summary and chat evidence belongs only to the supplied lesson; raw transcript is not a citation',()=>{
  assert.deepEqual(studyEvidence(lesson).map(item=>item.id),['p1-0']);
  assert.equal(studyInputSchema.safeParse({mode:'chat',lesson,question:''}).success,false);
});
test('summary is stored with server-resolved source text and survives archive schema roundtrip',async()=>{
  const result=await runStudy({mode:'summary',lesson,question:'',messages:[]},options(async(_url,request)=>{
    const body=JSON.parse(request.body);assert.equal(body.store,false);
    return output({overview:'수직항력의 방향을 배웠다.',sections:[{title:'수직항력',body:'수평 지면에서 위쪽으로 작용한다.',evidenceIds:['p1-0']}]});
  }));
  assert.equal(result.summary.sections[0].citations[0].text,lesson.source.pages[0].text);
  const archive=savedLessonSchema.parse(JSON.parse(JSON.stringify({version:1,id:'lesson-1',result:lesson,messages:[],...result})));
  assert.deepEqual(archive.summary,result.summary);
});
test('follow-up chat passes conversation context and resolves citations',async()=>{
  const messages=[{role:'user',content:'수직항력이 뭐야?'},{role:'assistant',content:'접촉면이 미는 힘입니다.'}];
  const result=await runStudy({mode:'chat',lesson,question:'그 방향은?',messages},options(async(_url,request)=>{
    assert.deepEqual(JSON.parse(JSON.parse(request.body).input).messages,messages);
    return output({answer:'수평 지면에서는 위쪽입니다.',supported:true,evidenceIds:['p1-0']});
  }));
  assert.equal(result.message.citations[0].label,'자료 1쪽');
});
test('missing or fabricated citations never become a grounded response',async()=>{
  for(const evidenceIds of [[],['foreign-lesson']])await assert.rejects(runStudy({mode:'chat',lesson,question:'방향?',messages:[]},options(async()=>output({answer:'위쪽',supported:true,evidenceIds}))));
  const result=await runStudy({mode:'chat',lesson,question:'자료 밖 질문',messages:[]},options(async()=>output({answer:'임의의 사실',supported:false,evidenceIds:[]})));
  assert.match(result.message.content,/확인할 수 없는/);
});
test('failed and incomplete service responses preserve ability to retry instead of saving a fake summary',async()=>{
  for(const response of [()=>new Response('',{status:503}),()=>Response.json({status:'incomplete'}),()=>output('bad json')])await assert.rejects(runStudy({mode:'summary',lesson,question:'',messages:[]},options(async()=>response())));
});
