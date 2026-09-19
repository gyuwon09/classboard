import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecognition } from '../lib/speech-normalization.ts';
import { generateBoard } from '../lib/agent.ts';
import { output, withVerificationMock, passingReport } from './verification-fixture.mjs';
const quote = '수평 지면 위 물체의 수직항력은 위쪽으로 작용한다. 중력은 아래쪽으로 작용한다.';
const evidence = [{ id: 'page-1-part-0', page: 1, quote }];
const correction = { from: '수직항녁', to: '수직항력', evidenceId: evidence[0].id };
test('no-op corrections are ignored and unit changes are rejected', () => {
  assert.deepEqual(normalizeRecognition('수직항력', [{...correction,from:'수직항력'}], evidence).changes, []);
  for (const [from,to] of [['kg','g'],['m/s','km/s'],['킬로그램','그램']]) {
    assert.throws(() => normalizeRecognition(from, [{...correction,from,to}], [{...evidence[0],quote:to}]));
  }
});
test('a rejected generated diagram is repaired once, with no unbounded retries', async () => {
  for (const repairSucceeds of [true,false]) {
    let generations = 0, reviews = 0;
    const result = await generateBoard({speech:'수직항력을 설명해줘.',pages:[{page:1,text:quote}],previousTitles:[]}, {
      apiKey:'test',model:'test',fetcher:async (_url, request) => {
        const body = JSON.parse(request.body);
        if (body.text?.format?.name === 'board_verification') {
          reviews++;
          const report = passingReport(body);
          if (reviews === 1 || !repairSucceeds) {
            const check = report.checks.find(item => item.id === 'layout');
            check.status = 'contradicted'; check.reason = '그림 방향을 수정하세요.';
          }
          return output(report);
        }
        generations++;
        if (generations === 2) assert.match(JSON.parse(body.input).repairHint,/그림/);
        return output({action:'ready',title:'수직항력',explanation:'수직항력은 위쪽으로 작용한다.',latex:'',diagram:'none',reason:'',evidenceId:evidence[0].id,corrections:[],visual:{kind:'concept',nodes:[{label:'수직항력',detail:'위쪽 방향',icon:'force'}]}});
      },
    });
    assert.equal(generations,2);
    assert.equal(result.action,repairSucceeds ? 'ready' : 'hold');
  }
});
test('textbook-backed pronunciation correction preserves the rest of the original statement', () => {
  const original = '수직항녁은 위쪽이다. 수직항녁이 3배 커지는 것은 아니다.';
  const result = normalizeRecognition(original, [correction], evidence);
  assert.equal(result.original, original);
  assert.equal(result.corrected, '수직항력은 위쪽이다. 수직항력이 3배 커지는 것은 아니다.');
  assert.equal(result.changes[0].page, 1);
});
test('correction cannot silently change numerical values, negation, direction or invent an ungrounded term', () => {
  for (const change of [{...correction,to:'허구힘'}, {...correction,from:'아래쪽',to:'위쪽'}, {...correction,from:'3',to:'9'}, {...correction,from:'아니다',to:'이다'}, {...correction,evidenceId:'missing'}]) {
    assert.throws(() => normalizeRecognition('수직항녁은 아래쪽으로 3배 작용하는 것이 아니다.', [change], evidence));
  }
  assert.throws(() => normalizeRecognition('수직항녁', [correction, correction], evidence));
});
test('corrected terms reach generation verification, including when a previous title is identical', async () => {
  const result = await generateBoard({ speech: '수직항녁은 위쪽으로 작용한다.', pages: [{page:1,text:quote}], previousTitles: ['수직항력'] }, {
    apiKey:'test',model:'test',fetcher:withVerificationMock(async () => output({action:'ready',title:'수직항력',explanation:'수직항력은 위쪽으로 작용한다.',latex:'',diagram:'none',reason:'',evidenceId:evidence[0].id,corrections:[correction],visual:{kind:'concept',nodes:[{label:'수직항력',detail:'위쪽 방향',icon:'force'}]}})),
  });
  assert.equal(result.action,'ready');
  assert.equal(result.recognition.corrected,'수직항력은 위쪽으로 작용한다.');
  assert.ok(result.verification.checks.some(check => check.id === 'recognition'));
});
