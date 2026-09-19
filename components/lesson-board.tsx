"use client";

import katex from 'katex';
import { LESSON } from '@/lib/lesson';

export function Formula({ latex, className = '' }: { latex: string; className?: string }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false, trust: false, strict: 'warn', maxExpand: 100, output: 'htmlAndMathml' });
  return <div className={`math-formula ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Explanation({ text }: { text: string }) {
  const parts = text.split(/(\\\([\s\S]*?\\\))/g);
  return <p className="concept-note">{parts.map((part, index) => part.startsWith('\\(') && part.endsWith('\\)') ? <span key={index} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(2, -2), { displayMode: false, throwOnError: false, trust: false, maxExpand: 100 }) }} /> : <span key={index}>{part}</span>)}</p>;
}

export function EarthFigure() {
  return <figure className="earth-figure">
    <div className="earth-stage">
      <img src="/earth-apollo17.jpg" alt="아프리카 대륙과 구름, 남극이 보이는 아폴로 17호의 실제 지구 사진" width="1024" height="1024" />
      <svg viewBox="0 0 420 420" className="earth-annotations" role="img" aria-label="지구 중심에서 표면까지 반지름 R, 표면의 물체 m, 바깥쪽 초기 속도 v">
        <line x1="210" y1="226" x2="326" y2="110" stroke="#bdeaff" strokeDasharray="5 5" strokeWidth="2" />
        <circle cx="210" cy="226" r="4" fill="#bdeaff" />
        <circle cx="326" cy="110" r="6" fill="#f4cd87" />
        <line x1="333" y1="103" x2="379" y2="57" stroke="#f4cd87" strokeWidth="3" />
        <path d="M365 58 L383 53 L378 71" fill="none" stroke="#f4cd87" strokeWidth="3" />
        <text x="266" y="193" fill="#c7edff" fontSize="24">R</text>
        <text x="374" y="96" fill="#f4cd87" fontSize="25">v</text>
        <text x="323" y="150" fill="#f4cd87" fontSize="22">m</text>
      </svg>
    </div>
    <figcaption>지구 질량 <strong>M</strong><span>NASA / Apollo 17 · 도식은 실제 축척과 다릅니다</span></figcaption>
  </figure>;
}

export function LessonBoard({ step, notes, cumulative = true }: { step: number; notes?: Record<number, string>; cumulative?: boolean }) {
  const lesson = LESSON[step];
  const equations = cumulative ? LESSON.map((item, index) => ({ ...item, index })).filter(item => item.index > 0 && item.index <= step) : [{ ...lesson, index: step }].filter(item => item.index > 0);
  return <section className={`teaching-board ${step > 1 ? 'has-derivation' : ''}`} aria-label="지구 탈출 속도 판서">
    <div className="board-topline"><span>지구 탈출 속도</span><span>{step + 1} / 6</span></div>
    <h2>{lesson.heading}</h2>
    <div className="board-body">
      <div className="earth-column"><EarthFigure /><div className="symbol-legend"><span><b>M</b> 지구의 질량</span><span><b>m</b> 물체의 질량</span><span><b>R</b> 지구의 반지름</span></div></div>
      <div className="derivation">
        {step === 0 && <p className="step-label">탈출 ≠ 중력이 사라짐</p>}
        <p className="concept-note">{notes?.[step] ?? lesson.note}</p>
        {equations.length > 0 && <ol className="equation-history" aria-label="지금까지의 수식 전개">{equations.map(item => <li key={item.index} className={item.index === step ? 'equation-row active-equation' : 'equation-row'} aria-current={item.index === step ? 'step' : undefined}>
          <p>{item.title}{item.index === step && <span>현재 단계</span>}</p>
          <Formula latex={item.index === 5 ? 'v_{\\mathrm{esc}} \\approx 11.2\\;\\mathrm{km/s}' : item.latex} />
          {item.index === 3 && <p className="equation-explanation">양변을 물체의 질량 m으로 나눕니다.</p>}
          {item.index === 5 && <p className="equation-explanation">약 11,186 m/s · G = 6.67430 × 10⁻¹¹, M = 5.9722 × 10²⁴ kg, R = 6.371 × 10⁶ m</p>}
        </li>)}</ol>}
        <p className="board-source">근거: 지구 탈출 속도 학습지 {lesson.page}쪽 · U(∞) = 0</p>
      </div>
    </div>
    <div className="board-assumptions">구대칭 지구의 지표면 출발 · 추가 추진 없음 · 공기 저항, 자전, 다른 천체의 영향 무시</div>
  </section>;
}
