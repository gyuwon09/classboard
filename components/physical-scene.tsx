"use client";
import { useId } from 'react';
import { projectilePoint, layoutSceneLabels, type BoardVisual, type SceneElement } from '@/lib/board-visual';

const colors = { ink: '#29483b', teal: '#187a70', blue: '#416bad', orange: '#b56b27', muted: '#b8ccc4' };
function Caption({ x, y, text, color = colors.ink, size = 23, halo = false }: { x: number; y: number; text: string; color?: string; size?: number; halo?: boolean }) {
  return <text x={x} y={y} textAnchor="middle" style={{ fill: color, stroke: halo ? '#fff' : 'none', strokeWidth: halo ? 4 : 0, paintOrder: 'stroke', strokeLinejoin: 'round', fontFamily: 'Arial, Malgun Gothic, sans-serif', fontSize: size, fontWeight: 550 }}>{text}</text>;
}
function Markers({ id }: { id: string }) {
  return <defs>{Object.entries(colors).map(([name, color]) => <marker key={name} id={`${id}-${name}`} markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M1 1 L6.5 4 L1 7" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>)}</defs>;
}
function Projectile({ visual, id }: { visual: BoardVisual; id: string }) {
  const options = visual.projectile ?? { velocity: true, components: true, gravity: true };
  const p = projectilePoint(0.25);
  const moving = [0, 0.125, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
  const arrow = (x: number, y: number, dx: number, dy: number, color: keyof typeof colors, key: string) => <path key={key} d={`M${x} ${y} l${dx} ${dy}`} fill="none" stroke={colors[color]} strokeWidth="4" strokeLinecap="round" markerEnd={`url(#${id}-${color})`} />;
  return <>
    <path d="M75 368 H890" stroke={colors.muted} strokeWidth="2" />
    <path d="M75 369 H890 V382 H75 Z" fill="#e8efeb" />
    <path d="M130 350 Q480 -90 830 350" fill="none" stroke={colors.blue} strokeWidth="3" strokeDasharray="7 8" />
    {moving.map(t => { const q = projectilePoint(t); return <circle key={t} cx={q.x} cy={q.y} r="10" fill={colors.blue} fillOpacity=".18" stroke={colors.blue} strokeOpacity=".35" />; })}
    <Caption x={480} y={84} text="최고점" size={22} />
    <path d="M480 94 V115" stroke={colors.muted} strokeWidth="1.5" />
    <Caption x={130} y={411} text="출발" size={21} />
    <Caption x={830} y={411} text="도착" size={21} />
    <Caption x={115} y={300} text="던진 물체" size={23} />
    <path d="M115 310 L126 333" stroke={colors.muted} strokeWidth="1.5" />
    <circle cx="130" cy="350" r="15" fill={colors.blue} stroke="white" strokeWidth="2" />
    {options.components && <>
      <path d={`M${p.x + p.dx} ${p.y} v${p.dy} h${-p.dx}`} fill="none" stroke={colors.muted} strokeWidth="1.5" strokeDasharray="4 5" />
      {arrow(p.x, p.y, p.dx, 0, 'teal', 'horizontal')}
      {arrow(p.x, p.y, 0, p.dy, 'orange', 'vertical')}
      <Caption x={p.x + 70} y={p.y + 33} text="수평 성분" color={colors.teal} size={20} />
      <Caption x={p.x - 72} y={p.y + p.dy / 2} text="연직 성분" color={colors.orange} size={20} />
    </>}
    {(options.velocity || options.components) && <>
      {arrow(p.x, p.y, p.dx, p.dy, 'blue', 'upward')}
      <Caption x={p.x + p.dx - 27} y={p.y + p.dy - 19} text="속도" color={colors.blue} size={21} />
      {[0.5, 0.75].map(t => { const q = projectilePoint(t); return <g key={t}>{arrow(q.x, q.y, q.dx, q.dy, 'blue', `velocity-${t}`)}<circle cx={q.x} cy={q.y} r="12" fill={colors.blue} stroke="white" strokeWidth="2" /></g>; })}
    </>}
    {options.gravity && <>{arrow(820, 124, 0, 94, 'orange', 'gravity')}<Caption x={820} y={109} text="중력" color={colors.orange} size={21} /></>}
    <circle cx={p.x} cy={p.y} r="16" fill={colors.blue} stroke="white" strokeWidth="3" />
    <circle cx={p.x - 5} cy={p.y - 5} r="4" fill="white" fillOpacity=".65" />
    <Caption x={500} y={451} text="점은 같은 시간 간격의 위치" color="#6d8379" size={19} />
  </>;
}

function SceneObject({ element: e, id }: { element: SceneElement; id: string }) {
  const color = colors[e.color];
  const left = Math.min(e.x, e.x2), top = Math.min(e.y, e.y2);
  const width = Math.max(6, Math.abs(e.x2 - e.x)), height = Math.max(6, Math.abs(e.y2 - e.y));
  const center = left + width / 2;
  const pathProps = { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeDasharray: e.dashed ? '7 7' : undefined };
  const object = (() => {
    switch (e.type) {
      case 'ball': return <><ellipse cx={center} cy={top + height / 2} rx={width / 2} ry={height / 2} fill={color} /><ellipse cx={left + width * 0.35} cy={top + height * 0.3} rx={width * 0.12} ry={height * 0.12} fill="white" fillOpacity=".6" /></>;
      case 'ellipse': return <ellipse cx={center} cy={top + height / 2} rx={width / 2} ry={height / 2} fill={color} fillOpacity=".1" stroke={color} strokeWidth="3" />;
      case 'block': case 'rect': return <rect x={left} y={top} width={width} height={height} rx={e.type === 'block' ? 7 : 0} fill={color} fillOpacity=".12" stroke={color} strokeWidth="3" />;
      case 'person': return <><circle cx={center} cy={top + height * 0.14} r={Math.min(width * 0.18, height * 0.13)} fill={color} fillOpacity=".15" stroke={color} strokeWidth="3" /><path d={`M${center} ${top + height * 0.3} V${top + height * 0.66} M${left} ${top + height * 0.53} L${center} ${top + height * 0.36} L${left + width} ${top + height * 0.48} M${left + width * 0.14} ${top + height} L${center} ${top + height * 0.66} L${left + width * 0.86} ${top + height}`} {...pathProps} /></>;
      case 'tree': return <><path d={`M${center} ${top + height * 0.5} V${top + height}`} stroke="#9b7853" strokeWidth={Math.max(5, width * 0.1)} /><ellipse cx={center} cy={top + height * 0.32} rx={width / 2} ry={height * 0.33} fill={color} fillOpacity=".17" stroke={color} strokeWidth="3" /></>;
      case 'sun': return <><circle cx={center} cy={top + height / 2} r={Math.min(width, height) * 0.28} fill={color} fillOpacity=".18" stroke={color} strokeWidth="3" />{Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, r = Math.min(width, height); return <path key={i} d={`M${center + Math.cos(a) * r * 0.36} ${top + height / 2 + Math.sin(a) * r * 0.36} l${Math.cos(a) * r * 0.12} ${Math.sin(a) * r * 0.12}`} {...pathProps} />; })}</>;
      case 'water': return <><rect x={left} y={top} width={width} height={height} fill={color} fillOpacity=".1" />{[0.18, 0.5, 0.82].map((level, i) => <path key={i} d={`M${left} ${top + height * level} q${width / 8} -9 ${width / 4} 0 t${width / 4} 0 t${width / 4} 0 t${width / 4} 0`} {...pathProps} strokeWidth="2" />)}</>;
      case 'cloud': return <path d={`M${left + width * 0.22} ${top + height * 0.88} C${left - width * 0.07} ${top + height * 0.88} ${left - width * 0.02} ${top + height * 0.32} ${left + width * 0.25} ${top + height * 0.38} C${left + width * 0.2} ${top - height * 0.1} ${left + width * 0.7} ${top - height * 0.1} ${left + width * 0.72} ${top + height * 0.36} C${left + width * 1.07} ${top + height * 0.22} ${left + width * 1.09} ${top + height * 0.92} ${left + width * 0.77} ${top + height * 0.88} Z`} fill="#eef3f4" stroke={color} strokeWidth="3" />;
      case 'rain': return <>{Array.from({ length: 12 }, (_, i) => { const x = left + width * ((i % 4 + 0.6) / 4.4), y = top + height * (Math.floor(i / 4) / 3); return <path key={i} d={`M${x} ${y} l${-width * 0.045} ${height * 0.17}`} {...pathProps} strokeWidth="2.5" />; })}</>;
      case 'spring': {
        const dx = e.x2 - e.x, dy = e.y2 - e.y, length = Math.hypot(dx, dy) || 1;
        const amplitude = Math.min(20, length / 10);
        const points = Array.from({ length: 15 }, (_, i) => {
          const t = (i + 1) / 16, offset = (i % 2 ? -1 : 1) * amplitude;
          return `${e.x + dx * t - dy / length * offset} ${e.y + dy * t + dx / length * offset}`;
        });
        return <path d={`M${e.x} ${e.y} L${points.join(' L')} L${e.x2} ${e.y2}`} {...pathProps} />;
      }
      case 'line': case 'arrow': return <path d={`M${e.x} ${e.y} L${e.x2} ${e.y2}`} {...pathProps} markerEnd={e.type === 'arrow' ? `url(#${id}-${e.color})` : undefined} />;
      case 'curve': return <path d={`M${e.x} ${e.y} Q${e.cx} ${e.cy} ${e.x2} ${e.y2}`} {...pathProps} />;
      case 'label': return null;
    }
  })();
  return <g>{object}</g>;
}

export function PhysicalScene({ visual }: { visual: BoardVisual }) {
  const id = `scene-${useId().replace(/:/g, '')}`;
  const projectile = visual.kind === 'projectile';
  const description = projectile ? '비스듬히 던진 공과 포물선 궤도, 같은 시간 간격의 위치 및 설명에 해당하는 속도 성분과 중력 방향' : `수업 현상 그림: ${visual.elements?.map(e => e.label).filter(Boolean).join(', ')}`;
  return <figure className="ab-diagram ab-physical-scene"><svg viewBox="0 0 960 500" role="img" aria-label={description}><Markers id={id} />{projectile ? <Projectile visual={visual} id={id} /> : <>{visual.elements?.map((element, i) => <SceneObject key={i} element={element} id={id} />)}{layoutSceneLabels(visual.elements ?? []).map((label, i) => <Caption key={`label-${i}`} {...label} color={colors[label.color]} size={21} halo />)}</>}</svg><figcaption>{projectile ? '공기저항을 무시하고 같은 높이로 돌아오는 운동의 예 · 축척 없음' : '수업 자료에 근거한 설명용 그림 · 축척 없음'}</figcaption></figure>;
}
