import test from 'node:test';
import assert from 'node:assert/strict';
import { boardVisualSchema, validateVisual, preferPhysicalScene, projectilePoint, layoutSceneLabels } from '../lib/board-visual.ts';
import { generateBoard } from '../lib/agent.ts';
import { withVerificationMock } from './verification-fixture.mjs';
const node = { label: '힘', detail: '크기와 방향', icon: 'force' };
test('projectile positions and velocity arrows describe the same ideal motion', () => {
  const points = [0, 0.25, 0.5, 0.75, 1].map(projectilePoint);
  assert.deepEqual(points.map(p => p.x), [130, 305, 480, 655, 830]);
  assert.equal(points[0].y, points[4].y);
  assert.equal(points[1].y, points[3].y);
  assert.ok(points[2].y < points[1].y);
  assert.ok(points[1].dy < 0);
  assert.equal(points[2].dy, 0);
  assert.ok(points[3].dy > 0);
  assert.ok(points.every(p => p.dx === points[0].dx));
  for (const t of [0.25, 0.5, 0.75]) {
    const p = projectilePoint(t), before = projectilePoint(t - 0.001), after = projectilePoint(t + 0.001);
    assert.ok(Math.abs((after.y - before.y) / (after.x - before.x) - p.dy / p.dx) < 1e-8);
  }
});
test('oblique throwing uses a real trajectory instead of formula icons', () => {
  const icons = { kind: 'concept', nodes: [node] };
  const scene = preferPhysicalScene(icons, '비스듬히 던진 물체의 속도 성분과 운동을 설명해 줘', '속도 분해');
  assert.equal(scene.kind, 'projectile');
  assert.equal(scene.projectile.components, true);
  assert.equal(scene.projectile.velocity, true);
  assert.equal(preferPhysicalScene(icons, '포물선의 방정식을 설명해 줘', '이차함수'), icons);
  assert.equal(preferPhysicalScene(icons, '공기저항을 고려한 포물선 운동', '항력을 받는 물체'), icons);
  assert.equal(preferPhysicalScene(icons, '공기저항을 무시한 포물선 운동', '던진 공').kind, 'projectile');
});
const ball = { type: 'ball', x: 100, y: 150, x2: 160, y2: 210, cx: 0, cy: 0, color: 'blue', label: '공', dashed: false };
test('scene labels avoid physical objects and stay within the canvas', () => {
  const sun = { ...ball, type: 'sun', x: 600, y: 60, x2: 680, y2: 140, label: '태양' };
  const cloud = { ...ball, type: 'cloud', x: 550, y: 145, x2: 730, y2: 205, label: '' };
  const labels = layoutSceneLabels([sun, cloud, { ...ball, type: 'label', x: 20, y: 480, label: '긴 이름표도 화면 안에 표시' }]);
  assert.ok(labels[0].y < sun.y);
  assert.ok(labels[1].x > 100);
  assert.ok(labels[1].y <= 476);
});
test('physical scenes require objects and reject formulas, scripts and out-of-bounds geometry', () => {
  const scene = { kind: 'scene', nodes: [node], elements: [ball] };
  assert.doesNotThrow(() => validateVisual(boardVisualSchema.parse(scene)));
  assert.throws(() => validateVisual({ ...scene, elements: [{ ...ball, type: 'label' }] }));
  assert.throws(() => validateVisual({ ...scene, elements: [{ ...ball, label: 'v = v0 cos θ' }] }));
  assert.equal(boardVisualSchema.safeParse({ ...scene, elements: [{ ...ball, x: -10 }] }).success, false);
  assert.equal(boardVisualSchema.safeParse({ ...scene, elements: [{ ...ball, onclick: 'alert(1)' }] }).success, false);
});
test('diagrams reject arbitrary markup payloads, unknown icons and excessive content', () => {
  assert.equal(boardVisualSchema.safeParse({ kind: 'concept', nodes: [node], svg: '<script />' }).success, false);
  assert.equal(boardVisualSchema.safeParse({ kind: 'concept', nodes: [{ ...node, icon: 'javascript' }] }).success, false);
  assert.equal(boardVisualSchema.safeParse({ kind: 'process', nodes: Array(5).fill(node) }).success, false);
  assert.equal(boardVisualSchema.safeParse({ kind: 'concept', nodes: [{ ...node, detail: '가'.repeat(33) }] }).success, false);
});
test('vector diagrams require two forces and a resultant; processes need a relationship', () => {
  assert.throws(() => validateVisual({ kind: 'vectors', nodes: [node, node] }));
  assert.throws(() => validateVisual({ kind: 'cycle', nodes: [node] }));
  assert.doesNotThrow(() => validateVisual({ kind: 'vectors', nodes: [node, node, node] }));
});
test('grounded diagram data passes through the AI pipeline with short explanation constraints', async () => {
  const visual = { kind: 'comparison', nodes: [node, { label: '질량', detail: '크기', icon: 'object' }] };
  let request;
  const frame = await generateBoard({ speech: '힘과 질량을 비교해 주세요.', pages: [{ page: 1, text: '힘은 크기와 방향을 가지고 질량은 크기만 가진다.' }], previousTitles: [] }, { apiKey: 'test', model: 'test', fetcher: withVerificationMock(async (_url, options) => {
    request = JSON.parse(options.body);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ action: 'ready', title: '힘과 질량', explanation: '힘에는 방향이 필요합니다.', latex: '', diagram: 'none', evidenceId: 'page-1-part-0', reason: '', visual }) }] }] });
  }) });
  assert.deepEqual(frame.visual, visual);
  assert.equal(request.text.format.schema.properties.explanation.maxLength, 80);
  assert.ok(request.text.format.schema.required.includes('visual'));
});

test('the board pipeline replaces a projectile icon map while preserving its source', async () => {
  const source = '비스듬히 던진 물체는 공기저항을 무시하면 포물선 운동을 한다. 수평 속도는 일정하다.';
  const frame = await generateBoard({ speech: '비스듬히 던진 물체의 속도 성분', pages: [{ page: 1, text: source }], previousTitles: [] }, {
    apiKey: 'test', model: 'test', fetcher: withVerificationMock(async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      action: 'ready', title: '포물선 운동', explanation: '수평 속도는 일정하다.', latex: '', diagram: 'none', evidenceId: 'page-1-part-0', reason: '', visual: { kind: 'concept', nodes: [node] },
    }) }] }] })),
  });
  assert.equal(frame.visual.kind, 'projectile');
  assert.equal(frame.visual.projectile.components, true);
  assert.equal(frame.quote, source);
  assert.equal(frame.sourcePage, 1);
});
