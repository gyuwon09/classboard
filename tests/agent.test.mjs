import test from 'node:test';
import assert from 'node:assert/strict';
import {boardInputSchema,generateBoard,validateGrounding,detectPhysicsConflict} from '../lib/agent.ts';
import { withVerificationMock } from './verification-fixture.mjs';
const pages=[{page:1,text:'지구 탈출 속도는 약 11.2 km/s이다. 같은 위치에서 물체 질량과 무관하다.'}];
const frame={action:'ready',title:'물체 질량',explanation:'같은 위치에서 탈출 속도는 물체 질량과 무관합니다.',latex:'',diagram:'earth',sourcePage:1,quote:pages[0].text,reason:''};
const {sourcePage,quote,...fields}=frame;
const modelPacket={...fields,evidenceId:'page-1-part-0'};
test('references must point to exact text on an existing page',()=>{
  assert.equal(validateGrounding(frame,pages),frame);
  assert.throws(()=>validateGrounding({...frame,sourcePage:2},pages));
  assert.throws(()=>validateGrounding({...frame,quote:'존재하지 않는 자료의 인용문입니다.'},pages));
  assert.throws(()=>validateGrounding({...frame,latex:'\\href{https://bad.test}{x}'},pages));
  assert.equal(validateGrounding({...frame,latex:'v=\\sqrt{2GM/R}'},pages).latex,'v=\\sqrt{2GM/R}');
});
test('a definition does not jump ahead to the final equation',async()=>{
 const result=await generateBoard({speech:'탈출 속도의 의미를 설명해 주세요.',pages,previousTitles:[]},{apiKey:'test',model:'test',fetcher:withVerificationMock(async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...modelPacket,latex:'v=\\sqrt{2GM/R}'})}]}]}))});
 assert.equal(result.latex,'');
});
test('unit conflicts are held before the language model call', async()=>{
  let called=false;
  const result=await generateBoard({speech:'지구 탈출 속도는 11.2 m/s입니다.',pages,previousTitles:[]},{apiKey:'test',model:'test',fetcher:async()=>{called=true;throw Error('not expected');}});
  assert.equal(result.action,'hold'); assert.equal(called,false);
  assert.equal(detectPhysicsConflict('11.2 km/s',pages),null);
  assert.ok(detectPhysicsConflict('초속 십일 점 이 미터',pages));
});
test('valid structured responses are accepted without executing model code',async()=>{
  let sent;
  const result=await generateBoard({speech:'물체 질량과 탈출 속도의 관계를 설명합니다.',pages,previousTitles:[]},{apiKey:'test',model:'test',fetcher:withVerificationMock(async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(modelPacket)}]}]});})});
  const {verification,...candidate}=result;
  assert.deepEqual(candidate,frame); assert.equal(verification.status,'passed'); assert.equal(sent.store,false); assert.equal(sent.text.format.strict,true);
  assert.equal(sent.text.format.schema.properties.explanation.maxLength,80);
  assert.equal(sent.text.format.schema.properties.latex.maxLength,350);
});
test('refusal, incomplete and malformed outputs never create a board',async()=>{
  const input={speech:'물체 질량과 탈출 속도',pages,previousTitles:[]};
  for(const payload of [{status:'incomplete'}, {output:[{type:'message',content:[{type:'refusal'}]}]}, {output:[{type:'message',content:[{type:'output_text',text:'invalid json'}]}]}]){
    await assert.rejects(generateBoard(input,{apiKey:'test',model:'test',fetcher:async()=>Response.json(payload)}));
  }
  assert.equal(boardInputSchema.safeParse({...input,speech:''}).success,false);
  assert.equal(boardInputSchema.safeParse({...input,pages:Array.from({length:21},()=>pages[0])}).success,false);
});
