import { z } from 'zod';

export const visualKinds = ['projectile', 'scene', 'concept', 'process', 'comparison', 'cycle', 'vectors'] as const;
export const visualIcons = ['object', 'force', 'motion', 'energy', 'ruler', 'globe', 'sun', 'water', 'plant', 'particle', 'book'] as const;
export const sceneTypes = ['ball', 'block', 'person', 'tree', 'sun', 'water', 'cloud', 'rain', 'spring', 'ellipse', 'rect', 'line', 'arrow', 'curve', 'label'] as const;
export const sceneColors = ['ink', 'teal', 'blue', 'orange', 'muted'] as const;
export const sceneElementSchema = z.object({
  type: z.enum(sceneTypes),
  x: z.number().min(20).max(940), y: z.number().min(20).max(480),
  x2: z.number().min(20).max(940), y2: z.number().min(20).max(480),
  cx: z.number().min(0).max(960), cy: z.number().min(0).max(500),
  color: z.enum(sceneColors), label: z.string().max(20), dashed: z.boolean(),
}).strict();
export type SceneElement = z.infer<typeof sceneElementSchema>;
/** Keep names outside physical objects, even when generated coordinates are crowded. */
export function layoutSceneLabels(elements: SceneElement[]) {
  type Box = { left: number; right: number; top: number; bottom: number };
  const physical = elements.filter(e => !['line', 'arrow', 'curve', 'label', 'spring'].includes(e.type)).map(e => ({ left: Math.min(e.x, e.x2), right: Math.max(e.x, e.x2), top: Math.min(e.y, e.y2), bottom: Math.max(e.y, e.y2) }));
  const placed: Box[] = [];
  const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return elements.filter(e => e.label).map(e => {
    const left = Math.min(e.x, e.x2), right = Math.max(e.x, e.x2), top = Math.min(e.y, e.y2), bottom = Math.max(e.y, e.y2);
    const half = Math.max(25, e.label.length * 11), center = (left + right) / 2;
    const line = ['line', 'arrow', 'curve', 'spring'].includes(e.type);
    const preferred = e.type === 'label' ? { x: e.x, y: e.y } : { x: center, y: line ? top - 14 : bottom + 28 };
    const candidates = [preferred, { x: center, y: top - 14 }, { x: right + half + 18, y: (top + bottom) / 2 + 8 }, { x: left - half - 18, y: (top + bottom) / 2 + 8 }].map((p, rank) => {
      const x = Math.max(half + 12, Math.min(948 - half, p.x)), y = Math.max(30, Math.min(476, p.y));
      const box = { left: x - half, right: x + half, top: y - 23, bottom: y + 7 };
      const score = physical.reduce((sum, b) => sum + overlap(box, b), 0) + placed.reduce((sum, b) => sum + overlap(box, b) * 4, 0) + rank;
      return { x, y, box, score };
    }).sort((a, b) => a.score - b.score);
    const best = candidates[0];
    placed.push(best.box);
    return { x: best.x, y: best.y, text: e.label, color: e.color === 'muted' ? 'ink' as const : e.color };
  });
}
export const projectileOptionsSchema = z.object({ velocity: z.boolean(), components: z.boolean(), gravity: z.boolean() }).strict();
export const boardVisualSchema = z.object({
  kind: z.enum(visualKinds),
  nodes: z.array(z.object({ label: z.string().min(1).max(18), detail: z.string().max(32), icon: z.enum(visualIcons) }).strict()).min(1).max(4),
  elements: z.array(sceneElementSchema).max(24).optional(),
  projectile: projectileOptionsSchema.optional(),
}).strict();
export type BoardVisual = z.infer<typeof boardVisualSchema>;
export const visualJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: [...visualKinds] },
    elements: { type: 'array', maxItems: 24, items: { type: 'object', additionalProperties: false, properties: {
      type: { type: 'string', enum: [...sceneTypes] },
      x: { type: 'number', minimum: 20, maximum: 940 }, y: { type: 'number', minimum: 20, maximum: 480 },
      x2: { type: 'number', minimum: 20, maximum: 940 }, y2: { type: 'number', minimum: 20, maximum: 480 },
      cx: { type: 'number', minimum: 0, maximum: 960 }, cy: { type: 'number', minimum: 0, maximum: 500 },
      color: { type: 'string', enum: [...sceneColors] }, label: { type: 'string', maxLength: 20 }, dashed: { type: 'boolean' },
    }, required: ['type', 'x', 'y', 'x2', 'y2', 'cx', 'cy', 'color', 'label', 'dashed'] } },
    projectile: { type: 'object', additionalProperties: false, properties: { velocity: { type: 'boolean' }, components: { type: 'boolean' }, gravity: { type: 'boolean' } }, required: ['velocity', 'components', 'gravity'] },
    nodes: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string', minLength: 1, maxLength: 18 }, detail: { type: 'string', maxLength: 32 }, icon: { type: 'string', enum: [...visualIcons] } }, required: ['label', 'detail', 'icon'] } },
  }, required: ['kind', 'nodes', 'elements', 'projectile'],
};

export function validateVisual(visual: BoardVisual | undefined) {
  if (!visual) return;
  if (visual.kind === 'scene') {
    if (!visual.elements?.some(element => ['ball', 'block', 'person', 'tree', 'sun', 'water', 'cloud', 'rain', 'spring', 'ellipse', 'rect'].includes(element.type))) throw Error('설명할 대상이 그림에 없습니다. 자료와 설명을 다시 확인해 주세요.');
    if (visual.elements.some(element => /\\(?:frac|sin|cos|sqrt)|\^|=/.test(element.label))) throw Error('그림에는 대상 이름만 표시하고 수식은 별도로 정리해야 합니다.');
  }
  if (visual.kind === 'vectors' && visual.nodes.length !== 3) throw Error('힘의 합성 그림에는 두 힘과 합력의 표기가 필요합니다. 다시 설명해 주세요.');
  if (['comparison', 'process', 'cycle'].includes(visual.kind) && visual.nodes.length < 2) throw Error('도식의 관계를 확인하지 못했습니다. 설명을 구체적으로 입력해 주세요.');
}

/** Physical scenes must not silently fall back to a concept-map icon list. */
export function preferPhysicalScene(visual: BoardVisual | undefined, speech: string, title: string): BoardVisual | undefined {
  const topic = `${speech} ${title}`;
  const projectile = /(?:비스듬|비슷듬|빗각|사선|포물선|투사체)/.test(topic) && /(?:던[지진져]|물체|공[을의은]|투사체|운동)/.test(topic);
  const resists = /공기\s*저항(?:을|이)?\s*(?:고려|있|받)|항력/.test(topic) && !/공기\s*저항(?:을|은)?\s*무시/.test(topic);
  if (!projectile || resists) return visual;
  return {
    kind: 'projectile', nodes: [{ label: '던진 물체', detail: '물체와 이동 궤도', icon: 'object' }], elements: [],
    projectile: { velocity: /속도|속력|성분|방향/.test(topic), components: /성분|수평|연직|분해/.test(topic), gravity: /중력|가속도|연직/.test(topic) },
  };
}

// A normalized ideal projectile: equally spaced times have equal horizontal steps.
// Screen y increases downward. The tangent is derived from the same trajectory.
export function projectilePoint(t: number) {
  const time = Math.max(0, Math.min(1, t));
  return { x: 130 + 700 * time, y: 350 - 880 * time * (1 - time), dx: 110, dy: 110 * (-880 + 1760 * time) / 700 };
}
