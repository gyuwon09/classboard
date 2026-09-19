import test from 'node:test';
import assert from 'node:assert/strict';
import { scenePhysics, describeArrow } from '../lib/scene-physics.ts';
import { verifyBoard } from '../lib/board-verification.ts';
const base = { cx: 0, cy: 0, color: 'blue', label: '', dashed: false };
const body = { ...base, type: 'block', x: 300, y: 220, x2: 480, y2: 320, label: '물체' };
const ground = { ...base, type: 'rect', x: 150, y: 320, x2: 780, y2: 340, label: '지면' };
const arrow = { ...base, type: 'arrow', x: 390, y: 280, x2: 390, y2: 450, label: '수직항력' };
const visual = { kind: 'scene', nodes: [{ label: '수직항력', detail: '', icon: 'force' }], elements: [ground, body, arrow] };
const quote = '수평 지면 위의 물체에는 지면이 위쪽으로 수직항력을 가한다. 중력은 아래쪽으로 작용한다.';
test('screen-coordinate direction is computed rather than inferred from the label', () => {
  assert.equal(describeArrow(arrow).direction, '아래쪽');
  assert.equal(describeArrow({ ...arrow, y2: 140 }).direction, '위쪽');
  assert.equal(describeArrow({ ...arrow, x2: 500, y2: 140 }).direction, '오른쪽·위쪽');
  assert.match(describeArrow({ ...arrow, y2: arrow.y }).direction, /길이 0/);
});
test('wrong floor-normal force and gravity directions are blocked by code', () => {
  assert.match(scenePhysics(visual, quote).issues[0], /수직항력/);
  assert.equal(scenePhysics({ ...visual, elements: [ground, body, { ...arrow, y2: 140 }] }, quote).issues.length, 0);
  assert.match(scenePhysics({ ...visual, elements: [body, { ...arrow, label: '중력', y2: 140 }] }, quote).issues[0], /중력/);
});
test('floor rule does not falsely apply to an incline, ceiling or force acting on the ground', () => {
  assert.equal(scenePhysics(visual, '경사면 위의 물체에는 경사면에 수직인 힘이 작용한다.').issues.length, 0);
  assert.equal(scenePhysics({ ...visual, elements: [{ ...ground, y: 190, y2: 220, label: '천장' }, body, arrow] }, quote).issues.length, 0);
  assert.equal(scenePhysics({ ...visual, elements: [ground, body, { ...arrow, y: 335 }] }, quote).issues.length, 0);
  assert.equal(scenePhysics({ ...visual, elements: [body, { ...arrow, label: '중력', x2: 150, y2: 280 }] }, '중력은 지구 중심을 향한다.').issues.length, 0);
});
test('a reversed arrow is held without trusting a model approval or making an API call', async () => {
  let calls = 0;
  const result = await verifyBoard({ action: 'ready', title: '수직항력', explanation: '힘은 위쪽이다.', latex: '', diagram: 'none', sourcePage: 1, quote, reason: '', visual }, [{ page: 1, text: quote }], '수직항력을 설명한다.', { apiKey: 'test', model: 'test', fetcher: async () => { calls++; throw Error('must not call'); } });
  assert.equal(result.action, 'hold');
  assert.match(result.reason, /아래쪽/);
  assert.equal(calls, 0);
});
