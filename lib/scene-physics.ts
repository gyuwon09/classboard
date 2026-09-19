import type { BoardVisual, SceneElement } from './board-visual.ts';

function bounds(e: SceneElement) {
  return { left: Math.min(e.x, e.x2), right: Math.max(e.x, e.x2), top: Math.min(e.y, e.y2), bottom: Math.max(e.y, e.y2) };
}
export function describeArrow(e: SceneElement) {
  const dx = e.x2 - e.x, dy = e.y2 - e.y;
  if (Math.hypot(dx, dy) < 1) return { dx, dy, direction: '길이 0: 방향 없음' };
  const horizontal = Math.abs(dx) < 1 ? '' : dx > 0 ? '오른쪽' : '왼쪽';
  const vertical = Math.abs(dy) < 1 ? '' : dy > 0 ? '아래쪽' : '위쪽';
  return { dx, dy, direction: [horizontal, vertical].filter(Boolean).join('·') };
}
export function scenePhysics(visual: BoardVisual | undefined, quote: string) {
  const elements = visual?.kind === 'scene' ? visual.elements ?? [] : [];
  const bodies = elements.filter(e => ['block', 'ball', 'person'].includes(e.type));
  const grounds = elements.filter(e => ['rect', 'line', 'block'].includes(e.type) && /지면|바닥/.test(e.label)).filter(e => {
    const b = bounds(e); return b.right - b.left > 3 * Math.max(1, b.bottom - b.top);
  });
  const arrows = elements.flatMap((element, index) => {
    if (element.type !== 'arrow') return [];
    // Include nearby standalone labels for the reviewer, without assuming every label belongs to this arrow.
    const nearbyLabels = elements.filter(e => e.type === 'label' && Math.hypot(e.x - (element.x + element.x2) / 2, e.y - (element.y + element.y2) / 2) < 140).map(e => e.label);
    return [{ id: `element-${index}`, label: element.label, nearbyLabels, start: { x: element.x, y: element.y }, end: { x: element.x2, y: element.y2 }, ...describeArrow(element) }];
  });
  const issues: string[] = [];
  for (const arrow of arrows) {
    if (!arrow.dx && !arrow.dy) { issues.push(`${arrow.id}: 화살표의 길이가 0이라 방향을 설명할 수 없습니다.`); continue; }
    const body = bodies.find(e => { const b = bounds(e); return arrow.start.x >= b.left - 5 && arrow.start.x <= b.right + 5 && arrow.start.y >= b.top - 5 && arrow.start.y <= b.bottom + 5; });
    if (!body) continue;
    const b = bounds(body);
    const floorBelow = grounds.some(e => { const g = bounds(e); return b.left < g.right && b.right > g.left && Math.abs(b.bottom - g.top) <= 12; });
    // Restricted to an explicitly named force acting on a body resting ON a horizontal floor.
    // Inclines, ceilings, reaction forces on the floor, and unlabeled arrows go to semantic review.
    if (/수직\s*항력/.test(arrow.label) && /수평\s*(?:지면|바닥)/.test(quote) && floorBelow && (arrow.dy >= 0 || Math.abs(arrow.dx) > Math.max(2, Math.abs(arrow.dy) * 0.03))) {
      issues.push(`${arrow.id}: 수평 지면 위 물체의 수직항력 화살표가 ${arrow.direction}으로 향합니다. 위쪽 수직 방향이어야 하므로 그림을 보류했습니다.`);
    }
    if (/^(?:중력|무게)(?:\s|$|[(:])/.test(arrow.label) && /중력[^.!?\n]*아래/.test(quote) && (arrow.dy <= 0 || Math.abs(arrow.dx) > Math.max(2, Math.abs(arrow.dy) * 0.03))) {
      issues.push(`${arrow.id}: 교재의 아래쪽 중력과 그림의 ${arrow.direction} 화살표가 다릅니다.`);
    }
  }
  return { arrows, issues };
}
