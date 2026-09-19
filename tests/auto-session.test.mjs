import test from 'node:test';
import assert from 'node:assert/strict';
import {TranscriptLedger, SerialLessonQueue} from '../lib/auto-session.ts';
const event=(type,item_id,extra={})=>({type,item_id,...extra});
const commit=id=>event('input_audio_buffer.committed',id);
const final=(id,transcript)=>event('conversation.item.input_audio_transcription.completed',id,{transcript});
test('interim captions update without producing a board sentence',()=>{
 const ledger=new TranscriptLedger();
 assert.deepEqual(ledger.ingest(event('conversation.item.input_audio_transcription.delta','a',{delta:'에너지'})),[]);
 ledger.ingest(event('conversation.item.input_audio_transcription.delta','a',{delta:' 보존'}));
 assert.equal(ledger.caption,'에너지 보존');
 ledger.ingest(commit('a'));
 assert.deepEqual(ledger.ingest(final('a','에너지가 보존됩니다.')),['에너지가 보존됩니다.']);
 assert.equal(ledger.caption,''); assert.equal(ledger.pending,0);
 assert.deepEqual(ledger.ingest(final('a','에너지가 보존됩니다.')),[]);
});
test('late completion of an earlier turn preserves teaching order',()=>{
 const ledger=new TranscriptLedger();ledger.ingest(commit('a'));ledger.ingest(commit('b'));
 assert.deepEqual(ledger.ingest(final('b','두 번째 설명')),[]);
 assert.deepEqual(ledger.ingest(final('a','첫 번째 설명')),['첫 번째 설명','두 번째 설명']);
});
test('completion before commit and failed turns do not deadlock',()=>{
 const ledger=new TranscriptLedger();ledger.ingest(final('a','준비된 문장'));
 assert.deepEqual(ledger.ingest(commit('a')),['준비된 문장']);
 ledger.ingest(commit('b'));ledger.ingest(commit('c'));ledger.ingest(final('c','다음 문장'));
 assert.deepEqual(ledger.ingest(event('conversation.item.input_audio_transcription.failed','b')),['다음 문장']);
 assert.equal(ledger.pending,0);
});
test('automatic board queue publishes in order and end waits for all work',async()=>{
 const received=[];let resolveFirst;const waiting=new Promise(resolve=>resolveFirst=resolve);
 const queue=new SerialLessonQueue(async text=>{if(text==='첫 설명')await waiting;return text;},value=>received.push(value),()=>assert.fail('unexpected error'));
 queue.enqueue('첫 설명');queue.enqueue('다음 설명');let ended=false;
 const end=queue.drain().then(()=>ended=true);await Promise.resolve();assert.equal(ended,false);
 resolveFirst();await end;assert.deepEqual(received,['첫 설명','다음 설명']);assert.equal(queue.size,0);
});
test('immediate stop discards queued work and ignores a stale success',async()=>{
 const received=[];let complete;const waiting=new Promise(resolve=>complete=resolve);
 const queue=new SerialLessonQueue(async text=>{await waiting;return text;},value=>received.push(value),()=>{});
 queue.enqueue('취소한 설명');queue.enqueue('아직 처리하지 않은 설명');queue.cancel();complete();await queue.drain();
 assert.deepEqual(received,[]);
 queue.enqueue('다시 시작한 설명');await queue.drain();assert.deepEqual(received,['다시 시작한 설명']);
});
test('a failed request is reported and does not discard later sentences',async()=>{
 const received=[],errors=[];
 const queue=new SerialLessonQueue(async text=>{if(text==='실패')throw Error('offline');return text;},value=>received.push(value),(error,text)=>errors.push(text));
 queue.enqueue('실패');queue.enqueue('다음 설명');await queue.drain();
 assert.deepEqual(received,['다음 설명']);assert.deepEqual(errors,['실패']);
});
