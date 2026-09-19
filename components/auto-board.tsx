"use client";
import { BookOpen, Mic } from 'lucide-react';
import { EarthFigure, Formula } from './lesson-board';
import { BoardDiagram } from './board-diagram';
import type { BoardFrame, SourcePage } from '@/lib/agent';
import { hasCurrentVerification } from '@/lib/board-verification';

export type LessonSource = { name: string; pages: SourcePage[] };
export type LessonFrame = BoardFrame & { id: string; sourceName: string; createdAt: string; edited?: boolean };
export type LessonResult = { frames: LessonFrame[]; transcript: string[]; source: LessonSource; startedAt: number; endedAt: number; notices: string[] };
function VerificationDetails({ frame }: { frame: LessonFrame }) {
  const review = frame.verification;
  if (!review) return null;
  return <details className="ab-verification"><summary>근거 검토 통과 · {review.checks.length}항목</summary><div className="ab-verification-body"><strong>{review.mode === 'textbook' ? '교재 근거 + 사실 검토' : '교재 관련성 + 외부 사실 검토'}</strong><p>용어·설명·수식·그림 관계를 AI가 검토했습니다. 사실의 완전한 보증은 아니며, 아래 근거로 확인할 수 있습니다.</p>{frame.recognition?.changes.length ? <p><b>음성 인식 보정</b><br />{frame.recognition.changes.map(change => `${change.from} → ${change.to}`).join(', ')}</p> : null}<ul>{review.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul><details><summary>항목별 교재 근거</summary>{review.checks.map(check => <p key={check.id}><b>{check.label}</b><br />{check.quote || '교재 직접 근거 없음 · 외부 자료로 확인'}</p>)}</details></div></details>;
}
export function AutoBoard({ frame, previous = [], number = 0, total = 0 }: { frame?: LessonFrame; previous?: LessonFrame[]; number?: number; total?: number }) {
  if (!frame) return <section className="ab-whiteboard ab-board-empty"><div className="ab-empty-sketch"><Mic size={36} /><span /><BookOpen size={54} /></div><h2>설명하면, 그림으로 이어집니다.</h2><p>마이크를 켜고 첫 개념을 설명해 주세요.</p><div className="ab-pen-tray"><i /><i /><i /></div></section>;
  if (!hasCurrentVerification(frame)) return <section className="ab-whiteboard ab-board-empty"><h2>근거 검증이 필요한 판서입니다.</h2><p>이 판서는 검증 전이거나 내용이 변경되어 표시하지 않았습니다. 수업 도구에서 다시 설명해 주세요.</p></section>;
  const visual = frame.visual ?? { kind: 'concept' as const, nodes: [{ label: frame.title.slice(0, 18), detail: '', icon: 'book' as const }] };
  return <section className="ab-whiteboard" aria-label="자동 판서">
    <header className="ab-note-heading"><div><span className="ab-note-kicker">오늘의 개념</span><h2>{frame.title}</h2></div><span className="ab-page-counter">{number} / {total}</span></header>
    <div className="ab-visual-content">
      <div className="ab-primary-visual">{frame.diagram === 'earth' ? <EarthFigure /> : <BoardDiagram visual={visual} />}</div>
      <div className="ab-key-takeaway"><p>{frame.explanation}</p>{frame.latex && <Formula latex={frame.latex} />}</div>
    </div>
    <footer className="ab-note-footer"><details className="ab-evidence"><summary><BookOpen size={14} />수업 관련 자료 {frame.sourcePage}쪽{frame.edited ? ' · 교사 수정 재검토' : ''}</summary><blockquote>{frame.quote}</blockquote></details><VerificationDetails frame={frame} />{previous.some(item => item.latex && hasCurrentVerification(item)) && <details className="ab-prior"><summary>이전 수식</summary>{previous.filter(item => item.latex && hasCurrentVerification(item)).slice(-2).map(item => <Formula key={item.id} latex={item.latex} />)}</details>}<span>{frame.sourceName}</span></footer>
  </section>;
}
