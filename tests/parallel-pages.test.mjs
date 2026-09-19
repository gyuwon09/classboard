import test from 'node:test';
import assert from 'node:assert/strict';
import {parallelPages} from '../lib/parallel-pages.ts';
test('image workers overlap up to three requests and preserve original page order',async()=>{
  let active=0,peak=0;const completed=[];
  const result=await parallelPages(7,new AbortController().signal,async page=>{
    peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,page===1?35:5));active--;completed.push(page);return page;
  });
  assert.equal(peak,3);assert.notEqual(completed[0],1);assert.deepEqual(result,[1,2,3,4,5,6,7]);assert.equal(active,0);
});
test('one page failure cancels siblings and prevents partial results or further dispatch',async()=>{
  const started=[];let drained=0;
  await assert.rejects(parallelPages(10,new AbortController().signal,async(page,signal)=>{
    started.push(page);if(page===2)throw Error('OCR failed');
    await new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener('abort',resolve,{once:true});});drained++;signal.throwIfAborted();
  }),/OCR failed/);
  assert.ok(started.length<=3);assert.equal(drained,started.length-1);
});
test('user cancellation stops all in-flight workers',async()=>{
  const controller=new AbortController();let started=0;
  const work=parallelPages(20,controller.signal,async(_page,signal)=>{started++;await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));signal.throwIfAborted();});
  controller.abort(new DOMException('cancel','AbortError'));
  await assert.rejects(work,{name:'AbortError'});assert.equal(started,3);
});
