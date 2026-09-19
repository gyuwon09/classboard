import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard } from '../lib/agent.ts';
import { boardReviewItems, verifyBoard, hasCurrentVerification, trustedReferenceUrl } from '../lib/board-verification.ts';
import { output, searchOutput, passingReport, referenceUrl } from './verification-fixture.mjs';

const source = '수직항력은 접촉면이 물체에 수직으로 가하는 힘이다. 수평 지면 위의 물체에는 위쪽으로 작용한다.';
const pages = [{ page: 1, text: source }];
const element = { type: 'block', x: 300, y: 200, x2: 450, y2: 300, cx: 0, cy: 0, color: 'blue', label: '물체', dashed: false };
const frame = { action: 'ready', title: '수직항력', explanation: '지면이 물체에 위쪽으로 힘을 가한다.', latex: '', diagram: 'none', sourcePage: 1, quote: source, reason: '', visual: { kind: 'scene', nodes: [{ label: '수직항력', detail: '면에 수직', icon: 'force' }], elements: [element, { ...element, type: 'arrow', x: 375, y: 300, x2: 375, y2: 140, label: '수직항력' }] } };
const speech = '지면 위 물체에 작용하는 수직항력을 설명해 줘.';
const options = fetcher => ({ apiKey: 'test', model: 'test', verificationModel: 'independent-reviewer', fetcher });
const mock = change => async (_url, request) => {
  const body = JSON.parse(request.body);
  if (body.tools) return searchOutput();
  const report = passingReport(body);
  change?.(report, body);
  return output(report);
};

test('unresolved invented terms are held after a correction attempt rather than defined', async () => {
  for (const term of ['발짜힘', '발자힘']) {
    let calls = 0;
    const result = await generateBoard({ speech: `${term}을 설명해 줘`, pages: [{ page: 1, text: `${term}은 땅이 사람을 밀어 올리는 힘이다.` }], previousTitles: [] }, options(async () => { calls++; const {sourcePage, quote, ...draft} = frame; return output({...draft, corrections: [], evidenceId:'page-1-part-0'}); }));
    assert.equal(result.action, 'hold');
    assert.equal(result.visual, undefined);
    assert.equal(result.title, '');
    assert.match(result.reason, /용어/);
    assert.equal(calls, 1);
  }
});
test('review inventory includes every scene element, formula and whole-scene relationships', () => {
  const items = boardReviewItems({ ...frame, latex: 'N=mg' }, speech);
  assert.deepEqual(items.map(item => item.id), ['relevance', 'speech', 'title', 'explanation', 'latex', 'node-0', 'element-0', 'element-1', 'layout']);
  assert.equal(items.find(item => item.id === 'element-1').content.computed.direction, '위쪽');
  const projectile = boardReviewItems({ ...frame, visual: { kind: 'projectile', nodes: frame.visual.nodes, projectile: { velocity: true, components: true, gravity: true } } }, speech).at(-1).content;
  assert.match(projectile.assumptions, /공기저항/);
  assert.equal(projectile.points[4].dy, 0);
  assert.ok(projectile.options.gravity);
});
test('only complete source-backed independent review produces a content-bound receipt', async () => {
  const requests = [];
  const verified = await verifyBoard(frame, pages, speech, options(async (url, request) => {
    requests.push(JSON.parse(request.body));
    return mock()(url, request);
  }));
  assert.equal(verified.action, 'ready');
  assert.ok(hasCurrentVerification(verified));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].tools, undefined);
  assert.equal(requests[0].model, 'independent-reviewer');
  assert.equal(verified.verification.checks.length, boardReviewItems(frame, speech).length);
  assert.deepEqual(verified.verification.sources, []);
  assert.equal(verified.verification.mode, 'textbook');
  assert.equal(hasCurrentVerification({ ...verified, explanation: '수직항력은 아래로 작용한다.' }), false);
  assert.equal(hasCurrentVerification({ ...verified, visual: { ...verified.visual, elements: [{ ...element, label: '허구 물체' }] } }), false);
  assert.equal(hasCurrentVerification(frame), false);
});
test('a single unsupported term, wrong formula or reversed arrow prevents the whole board', async () => {
  for (const id of ['speech', 'title', 'explanation', 'element-1', 'layout']) {
    const result = await verifyBoard(frame, pages, speech, options(mock(report => {
      const check = report.checks.find(item => item.id === id);
      check.status = 'contradicted'; check.reason = '교재와 방향 또는 용어가 다릅니다.';
    })));
    assert.equal(result.action, 'hold');
    assert.equal(result.verification, undefined);
    assert.equal(result.visual, undefined);
  }
  const result = await verifyBoard({ ...frame, latex: 'N=-mg' }, pages, speech, options(mock(report => {
    report.checks.find(item => item.id === 'latex').status = 'uncertain';
  })));
  assert.equal(result.action, 'hold');
});
test('missing, duplicated and unknown checks cannot pass by partial approval', async () => {
  for (const mutate of [r => r.checks.pop(), r => { r.checks[1] = r.checks[0]; }, r => { r.checks[0].id = 'made-up'; }]) {
    const result = await verifyBoard(frame, pages, speech, options(mock(mutate)));
    assert.equal(result.action, 'hold');
  }
});
test('fabricated quotes and unreturned source URLs cannot be used as evidence', async () => {
  for (const mutate of [r => { r.checks[0].quoteId = 'missing-quote'; }, r => { r.checks[0].referenceUrls = ['https://openstax.org/fabricated']; }]) {
    assert.equal((await verifyBoard(frame, pages, speech, options(mock(mutate)))).action, 'hold');
  }
  let called = false;
  const result = await verifyBoard({ ...frame, quote: '존재하지 않는 교재 인용문' }, pages, speech, options(async () => { called = true; }));
  assert.equal(result.action, 'hold'); assert.equal(called, false);
});
test('trusted domain matching rejects lookalike, credential-bearing and unsafe links', () => {
  for (const url of ['https://openstax.org.evil.test/x', 'https://evil.test/?openstax.org', 'https://evil@openstax.org/a', 'http://openstax.org/a', 'javascript:alert(1)', 'https://openstax.org:999/a']) assert.equal(trustedReferenceUrl(url), false);
  assert.equal(trustedReferenceUrl(referenceUrl), true);
  assert.equal(trustedReferenceUrl('https://science.nasa.gov/a'), true);
});
test('search refusal, missing actual search, missing citations, malformed audit and outages fail closed', async () => {
  for (const response of [() => output('no sources'), () => Response.json({ status: 'incomplete' }), () => Response.json({ status: 'completed', output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', text: 'Uncited knowledge.' }] }] }), () => new Response('', { status: 503 })]) {
    assert.equal((await verifyBoard(frame, pages, speech, options(async () => response()))).action, 'hold');
  }
  assert.equal((await verifyBoard(frame, pages, speech, options(async (_url, request) => JSON.parse(request.body).tools ? searchOutput() : output('not json')))).action, 'hold');
  assert.equal((await verifyBoard(frame, pages, speech, options(async () => { throw Error('network'); }))).action, 'hold');
});
test('cancellation never returns an approved board', async () => {
  const controller = new AbortController(); controller.abort(new DOMException('aborted', 'AbortError'));
  await assert.rejects(verifyBoard(frame, pages, speech, { ...options(async () => { throw controller.signal.reason; }), signal: controller.signal }), { name: 'AbortError' });
});

test('related extension forces external review and can omit a fabricated textbook quote',async()=>{
  const result=await verifyBoard({...frame,relatedExtension:true},pages,speech,options(async(_url,request)=>{
    const body=JSON.parse(request.body);if(body.tools)return searchOutput();
    const report=passingReport(body);
    const fact=report.checks.find(check=>check.id==='explanation');
    if(JSON.parse(body.input).mode==='external'){fact.quoteId='';fact.referenceUrls=[referenceUrl];}
    return output(report);
  }));
  assert.equal(result.action,'ready');assert.equal(result.verification.mode,'external');
  assert.equal(result.verification.checks.find(check=>check.id==='explanation').quote,'');
});
test('unrelated subject is rejected even if its facts would be correct',async()=>{
  let calls=0;
  const result=await verifyBoard(frame,pages,'전혀 무관한 주제',options(async(_url,request)=>{
    calls++;const report=passingReport(JSON.parse(request.body));
    const relevance=report.checks.find(check=>check.id==='relevance');relevance.status='contradicted';relevance.reason='수업 주제와 관련이 없습니다.';
    return output(report);
  }));
  assert.equal(result.action,'hold');assert.match(result.reason,/관련/);assert.equal(calls,1);
});

test('truncated, malformed and transient failures recover with one bounded retry', async () => {
  for (const fail of [() => Response.json({status:'incomplete'}), () => output('broken json'), () => new Response('',{status:503}), () => { throw new TypeError('network'); }]) {
    let calls = 0;
    const result = await verifyBoard(frame,pages,speech,options(async (_url,request) => {
      calls++;
      if (calls === 1) return fail();
      return output(passingReport(JSON.parse(request.body)));
    }));
    assert.equal(calls,2);
    assert.equal(result.action,'ready');
    assert.equal(result.verification.checks[0].quote,frame.quote);
  }
});

test('persistent failures are classified and permanent API errors are not retried', async () => {
  for (const [status,expected,callsExpected] of [[401,/인증/,1],[400,/설정/,1],[429,/한도/,2],[503,/일시적/,2]]) {
    let calls = 0;
    const result = await verifyBoard(frame,pages,speech,options(async () => {calls++; return new Response('',{status});}));
    assert.equal(calls,callsExpected);
    assert.equal(result.action,'hold');
    assert.match(result.reason,expected);
    assert.equal(result.verification,undefined);
  }
});

test('large scene review returns compact quote ids and restores original evidence server-side', async () => {
  const large = {...frame,visual:{...frame.visual,elements:Array.from({length:24},()=>({...frame.visual.elements[0]}))}};
  const result = await verifyBoard(large,pages,speech,options(async (_url,request) => {
    const body = JSON.parse(request.body);
    const report = passingReport(body);
    assert.ok(report.checks.length >= 28);
    assert.ok(JSON.stringify(report).length < 5000);
    assert.ok(report.checks.every(check => check.quoteId === 'q0' && !('quote' in check)));
    return output(report);
  }));
  assert.equal(result.action,'ready');
  assert.ok(result.verification.checks.every(check => check.quote === frame.quote));
});

test('aborting during retry delay prevents another request', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = verifyBoard(frame,pages,speech,{...options(async () => {
    calls++;
    setTimeout(()=>controller.abort(new DOMException('stop','AbortError')),20);
    return new Response('',{status:503});
  }),signal:controller.signal});
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(calls,1);
});

test('only uncertain facts trigger external search and must receive their own citation', async () => {
  for (const cite of [true, false]) {
    const requests = [];
    const result = await verifyBoard(frame, pages, speech, options(async (_url, request) => {
      const body = JSON.parse(request.body); requests.push(body);
      if (body.tools) return searchOutput();
      const report = passingReport(body);
      if (JSON.parse(body.input).mode === 'textbook') report.checks.find(c=>c.id==='speech').status = 'uncertain';
      else if (!cite) report.checks.find(c=>c.id==='speech').referenceUrls = [];
      return output(report);
    }));
    assert.equal(requests.length, 3);
    assert.equal(requests[1].tool_choice, 'required');
    assert.equal(result.action, cite ? 'ready' : 'hold');
    if (cite) assert.equal(result.verification.mode, 'external');
  }
});
