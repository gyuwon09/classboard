"use client";
import { useId } from 'react';
import { ArrowUpRight, Atom, BookOpen, Box, Droplets, Globe2, Leaf, MoveRight, Ruler, Sun, Zap } from 'lucide-react';
import type { BoardVisual } from '@/lib/board-visual';
import { PhysicalScene } from './physical-scene';

const ink = ['#187a70', '#b56b27', '#416bad'];
const icons = { object: Box, force: ArrowUpRight, motion: MoveRight, energy: Zap, ruler: Ruler, globe: Globe2, sun: Sun, water: Droplets, plant: Leaf, particle: Atom, book: BookOpen };
function lines(text: string, width: number) { return text.match(new RegExp(`.{1,${width}}`, 'gu')) ?? []; }
function Node({ node, x, y, index }: { node: BoardVisual['nodes'][number]; x: number; y: number; index: number }) {
  const Icon = icons[node.icon];
  const title = lines(node.label, 10), detail = lines(node.detail, 16);
  return <g className={`ab-diagram-node tone-${index % 3}`}>
    <circle cx={x} cy={y} r="51" style={{ fill: ink[index % 3], fillOpacity: 0.07, stroke: ink[index % 3], strokeWidth: 1.3, strokeOpacity: 0.28 }} />
    <Icon x={x - 27} y={y - 27} width="54" height="54" strokeWidth="1.6" style={{ color: ink[index % 3], stroke: ink[index % 3] }} />
    <text x={x} y={y + 87} textAnchor="middle" className="ab-node-label" style={{ fill: '#29483b', fontSize: 28, fontWeight: 650 }}>{title.map((line, i) => <tspan key={i} x={x} dy={i ? 27 : 0}>{line}</tspan>)}</text>
    <text x={x} y={y + 90 + title.length * 27} textAnchor="middle" className="ab-node-detail" style={{ fill: '#658072', fontSize: 21 }}>{detail.map((line, i) => <tspan key={i} x={x} dy={i ? 23 : 0}>{line}</tspan>)}</text>
  </g>;
}

export function BoardDiagram({ visual }: { visual: BoardVisual }) {
  const id = useId().replace(/:/g, '');
  if (visual.kind === 'projectile' || visual.kind === 'scene') return <PhysicalScene visual={visual} />;
  const nodes = visual.nodes;
  const vector = visual.kind === 'vectors' && nodes.length === 3;
  const width = nodes.length <= 2 ? 640 : 960, height = visual.kind === 'concept' && nodes.length > 2 ? 470 : 390;
  const positions = nodes.map((_, index) => ({ x: width * (index + 0.5) / nodes.length, y: 150 }));
  if (visual.kind === 'concept' && nodes.length > 2) {
    positions[0] = { x: 200, y: 170 };
    for (let i = 1; i < nodes.length; i++) positions[i] = { x: 480 + (i - 1) * 205, y: i % 2 ? 125 : 235 };
  }
  const description = `${visual.kind === 'vectors' ? '두 힘의 평행사변형 합성 개념도' : visual.kind === 'process' ? '순서도' : visual.kind === 'cycle' ? '순환도' : visual.kind === 'comparison' ? '비교 그림' : '개념 관계도'}: ${nodes.map(node => `${node.label}${node.detail ? `, ${node.detail}` : ''}`).join('; ')}`;
  return <figure className={`ab-diagram ab-diagram-${visual.kind}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
      <defs>{['a', 'b', 'c'].map((tone, i) => <marker key={tone} id={`${id}-${tone}`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth"><path d="M1 1 L7 4.5 L1 8" fill="none" stroke={ink[i]} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></marker>)}</defs>
      {vector ? <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M140 285 L635 285 L825 85 L330 85 Z" fill="#187a70" fillOpacity=".045" stroke="none" />
        <path d="M635 285 L825 85 L330 85" stroke="#bdceca" strokeWidth="2" strokeDasharray="8 9" />
        <path d="M140 285 L635 285" stroke="#187a70" strokeWidth="5" markerEnd={`url(#${id}-a)`} />
        <path d="M140 285 L330 85" stroke="#b56b27" strokeWidth="5" markerEnd={`url(#${id}-b)`} />
        <path d="M140 285 L825 85" stroke="#416bad" strokeWidth="6" markerEnd={`url(#${id}-c)`} />
        <circle cx="140" cy="285" r="7" fill="#233b38" stroke="none" />
        <text x="500" y="325" className="ab-vector-label tone-0" style={{ fill: ink[0], stroke: 'none', fontSize: 29, fontWeight: 650 }} textAnchor="middle">{nodes[0].label}</text>
        <text x="270" y="60" className="ab-vector-label tone-1" style={{ fill: ink[1], stroke: 'none', fontSize: 29, fontWeight: 650 }} textAnchor="middle">{nodes[1].label}</text>
        <text x="810" y="54" className="ab-vector-label tone-2" style={{ fill: ink[2], stroke: 'none', fontSize: 29, fontWeight: 650 }} textAnchor="middle">{nodes[2].label}</text>
        <text x="140" y="332" className="ab-node-detail" style={{ fill: '#658072', stroke: 'none', fontSize: 21 }} textAnchor="middle">작용점</text>
      </g> : <>
        {visual.kind === 'concept' && positions.slice(1).map((point, index) => <path key={index} d={`M${positions[0].x + 57} ${positions[0].y} Q${point.x - 90} ${positions[0].y - 45} ${point.x - 60} ${point.y}`} fill="none" stroke="#bdceca" strokeWidth="2.5" />)}
        {['process', 'cycle'].includes(visual.kind) && positions.slice(1).map((point, index) => <path key={index} d={`M${positions[index].x + 63} ${point.y} H${point.x - 65}`} fill="none" stroke="#187a70" strokeWidth="3" markerEnd={`url(#${id}-a)`} />)}
        {visual.kind === 'cycle' && <path d={`M${positions.at(-1)!.x} 88 C${positions.at(-1)!.x} 10 ${positions[0].x} 10 ${positions[0].x} 88`} fill="none" stroke="#b56b27" strokeWidth="2.5" strokeDasharray="6 6" markerEnd={`url(#${id}-b)`} />}
        {visual.kind === 'comparison' && positions.slice(1).map((point, index) => <path key={index} d={`M${(point.x + positions[index].x) / 2} 85 V325`} stroke="#bdceca" strokeWidth="1" strokeDasharray="4 8" />)}
        {nodes.map((node, index) => <Node key={index} node={node} index={index} {...positions[index]} />)}
      </>}
    </svg>
    {vector && <div className="ab-vector-key">{nodes.map((node, i) => <span key={i} className={`tone-${i}`}><i />{node.detail || node.label}</span>)}</div>}
    <figcaption>{vector ? '평행사변형 합성 개념도 · 길이와 각도는 실제 축척이 아닙니다' : '수업 자료를 바탕으로 정리한 개념도'}</figcaption>
  </figure>;
}
