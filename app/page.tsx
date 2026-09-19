"use client";

import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Download, Maximize, Orbit, Pause, Pencil, Play, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LessonBoard } from '@/components/lesson-board';
import { LiveClassroom } from '@/components/live-classroom';
import { buildReviewPdf } from '@/lib/pdf-export';
import { useLessonTools } from '@/components/use-lesson-tools';
import { BUILTIN_PAGES, LESSON } from '@/lib/lesson';
import { initialPlayback, playbackReducer } from '@/lib/playback';

export default function Home() {
  const [mode, setMode] = useState('example');
  const [playback, dispatch] = useReducer(playbackReducer, initialPlayback);
  const { step, playing, remaining, duration } = playback;
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<Record<number, string>[]>([]);
  const [dialog, setDialog] = useState<'source' | 'edit' | 'export' | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportReady, setExportReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  useLessonTools({ mode, step: step + 1, playing, title: LESSON[step].title }, value => dispatch({ type: 'seek', step: value }));

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, [playing, step, duration]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) dispatch({ type: 'pause' }); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode !== 'example' || dialog || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof Element && event.target.closest('input,textarea,select,button,a,[contenteditable], [role="slider"]'))) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); dispatch({ type: 'seek', step: step + 1 }); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); dispatch({ type: 'seek', step: step - 1 }); }
      if (event.key === ' ') { event.preventDefault(); dispatch({ type: 'toggle' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, dialog, mode]);

  function openDialog(value: 'source' | 'edit' | 'export') {
    dispatch({ type: 'pause' });
    if (value === 'edit') setDraft(notes[step] ?? LESSON[step].note);
    setStatus('');
    setDialog(value);
  }
  function saveNote() {
    if (!draft.trim()) return;
    setHistory(previous => [...previous.slice(-19), notes]);
    setNotes(previous => ({ ...previous, [step]: draft.trim() }));
    setDialog(null);
    setStatus('설명을 수정했습니다. 되돌리기로 이전 설명을 복원할 수 있습니다.');
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setNotes(previous); setHistory(history.slice(0, -1));
    setStatus('직전 설명 수정 내용을 되돌렸습니다.');
  }
  async function fullScreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch { setStatus('전체 화면을 열지 못했습니다. 브라우저의 전체 화면 기능을 사용해 주세요.'); }
  }
  async function exportPdf() {
    if (!pdfRef.current || exporting) return;
    setExporting(true); setExportProgress(0); setExportReady(false); setStatus('');
    try {
      const documentPdf = await buildReviewPdf(pdfRef.current, setExportProgress);
      documentPdf.save('classboard-earth-escape.pdf');
      setExportReady(true);
    } catch { setStatus('PDF를 만들지 못했습니다. 수업 내용은 그대로 유지됩니다. 다시 시도해 주세요.'); }
    finally { setExporting(false); }
  }

  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/"><Orbit size={28} /><span>클래스보드<sup>AI</sup></span></a><span className="header-context">교사가 이끄는 자동 판서 수업</span><span className="mode-tag">{mode === 'example' ? '예제 수업' : '실시간 AI'}</span></header>
    <main className="workspace">
      <div className="workspace-title"><div><p className="breadcrumb">{mode === 'example' ? '물리학 / 역학과 에너지' : '수업 자료 / 설명 / 교사 확인'}</p><h1>{mode === 'example' ? '지구 탈출 속도' : '실시간 수업 판서'}</h1></div>{mode === 'example' && <Button variant="outline" onClick={() => openDialog('export')}><Download />복습 PDF</Button>}</div>
      <Tabs value={mode} onValueChange={value => { dispatch({ type: 'pause' }); setMode(value); }}><TabsList className="classroom-tabs" aria-label="수업 방식"><TabsTrigger value="example">지구 탈출 속도 예제</TabsTrigger><TabsTrigger value="live">내 자료로 실시간 판서</TabsTrigger></TabsList><TabsContent value="example" forceMount className="classroom-tab-content">
      <div className="teaching-layout"><section className="board-column">
        <div ref={stageRef} className="presentation-surface">
          <div className="board-toolbar"><span>단계별 판서</span><span>← → 단계 이동 · Space 자동 진행 / 정지</span><Button variant="ghost" size="icon" aria-label="판서 전체 화면 전환" onClick={fullScreen}><Maximize size={18} /></Button></div>
          <div className="board-scroll"><LessonBoard step={step} notes={notes} /></div>
          <div className="step-navigation">
            <Button variant="outline" disabled={step === 0} onClick={() => dispatch({ type: 'seek', step: step - 1 })}><ArrowLeft />이전</Button>
            <div className="playback-control"><Button variant="outline" disabled={step === 5} onClick={() => dispatch({ type: 'toggle' })}>{playing ? <Pause /> : <Play />}{playing ? '일시정지' : '자동 진행'}</Button><span>{playing ? `${remaining}초 후 다음 단계` : step === 5 ? '마지막 단계 · 질문과 정리' : '수동 진행 · 읽는 시간 제한 없음'}</span></div>
            <Button disabled={step === 5} onClick={() => dispatch({ type: 'seek', step: step + 1 })}>다음 단계<ArrowRight /></Button>
          </div>
        </div>
        <div className="lesson-strip" aria-label="수업 단계">{LESSON.map((lesson, i) => <button key={lesson.title} onClick={() => dispatch({ type: 'seek', step: i })} aria-current={step === i ? 'step' : undefined} className={step === i ? 'current' : ''}><span>{i < step ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span><b>{lesson.title}</b><small>{lesson.short}</small></button>)}</div>
        <div className="screen-reader-status" role="status">{step + 1}단계: {LESSON[step].title}</div>
        {status && <p className="feedback" role="status">{status}</p>}
      </section>
      <aside className="teacher-panel">
        <div className="panel-heading"><Settings2 size={18} /><h2>수업 도우미</h2></div>
        <button className="source-card" onClick={() => openDialog('source')}><BookOpen size={20} /><span><strong>지구 탈출 속도 학습지</strong><small>직접 제작 자료 · 3쪽 · 열기</small></span><ArrowRight size={17} /></button>
        <section className="panel-section"><h3>현재 설명</h3><p className="teacher-script">{LESSON[step].speech}</p><div className="source-line">참조: 학습지 {LESSON[step].page}쪽</div><div className="edit-actions"><Button size="sm" variant="outline" onClick={() => openDialog('edit')}><Pencil />설명 수정</Button><Button size="sm" variant="ghost" disabled={!history.length} onClick={undo}><RotateCcw />되돌리기</Button></div></section>
        <section className="panel-section"><h3>자동 진행 간격 <span>{duration}초</span></h3><Slider aria-label="자동 진행 간격" min={20} max={60} step={5} value={[duration]} onValueChange={value => dispatch({ type: 'duration', seconds: value[0] })} /><p className="pace-notice">기본은 수동 진행입니다. 자동 진행도 언제든 멈출 수 있습니다.</p><p className="secondary-note">다른 탭으로 이동하거나 내용을 수정하면 자동 진행이 멈춥니다.</p></section>
        <div className="teacher-tip"><strong>이해 확인 질문</strong><p>{step < 3 ? '멀어지면 중력이 갑자기 사라질까요?' : '물체의 질량이 두 배면 탈출 속도도 두 배일까요?'}</p></div>
      </aside></div></TabsContent><TabsContent value="live" forceMount className="classroom-tab-content"><LiveClassroom active={mode === 'live'} /></TabsContent></Tabs>
    </main>
    <footer className="app-footer"><span>{mode === 'example' ? '예제 수업 · 준비된 자료를 단계별로 표시합니다' : '실시간 판서 · AI 제안은 교사 확인 후 표시합니다'}</span><a href="https://svs.gsfc.nasa.gov/30613" target="_blank" rel="noreferrer">NASA 이미지 출처</a></footer>

    <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !exporting) setDialog(null); }}><DialogContent className="lesson-dialog"><DialogHeader><DialogTitle>{dialog === 'source' ? '수업 근거 자료' : dialog === 'edit' ? '현재 단계의 설명 수정' : '복습 PDF'}</DialogTitle><DialogDescription>{dialog === 'source' ? '현재 예제 수업에 사용하는 직접 제작 학습지입니다.' : dialog === 'edit' ? '학생에게 보여줄 설명을 수정하세요. 수식과 원본 학습지는 유지됩니다.' : '6단계 판서와 수정한 설명을 함께 저장합니다. 내용을 확인한 뒤 다운로드하세요.'}</DialogDescription></DialogHeader>
      {dialog === 'source' && <div className="source-pages">{BUILTIN_PAGES.map(page => <section key={page.page}><h3>{page.page}쪽</h3><p>{page.text}</p></section>)}<a href="https://openstax.org/books/university-physics-volume-1/pages/13-3-gravitational-potential-energy-and-total-energy" target="_blank" rel="noreferrer">에너지 보존과 탈출 속도 참고 자료</a></div>}
      {dialog === 'edit' && <><label htmlFor="teacher-note">학생에게 표시할 설명</label><textarea id="teacher-note" value={draft} onChange={event => setDraft(event.target.value)} maxLength={180} rows={5} /><p className="secondary-note">{draft.length} / 180자 · 한 단계에는 하나의 개념을 담아 주세요.</p><Button disabled={!draft.trim()} onClick={saveNote}>수정 반영</Button></>}
      {dialog === 'export' && <><ol className="export-outline">{LESSON.map((lesson, i) => <li key={lesson.title}><Check size={16} /><span>{i + 1}. {lesson.title}</span>{notes[i] && <small>교사 수정 반영</small>}</li>)}</ol><p className="secondary-note">지구 사진·수식·가정이 포함된 가로형 6쪽 PDF입니다. 글자는 화면 모양을 보존하는 이미지로 저장됩니다.</p><Button disabled={exporting} onClick={exportPdf}><Download />{exporting ? `PDF 생성 중 (${exportProgress}/6)` : '내용 확인 · PDF 다운로드'}</Button>{exportReady && <p role="status">PDF를 생성했습니다. 브라우저 다운로드 목록을 확인하세요.</p>}{status && <p role="alert">{status}</p>}</>}
    </DialogContent></Dialog>
    {dialog === 'export' && <div className="pdf-render-root" ref={pdfRef} aria-hidden="true">{LESSON.map((_, i) => <div className="pdf-page" key={i}><LessonBoard step={i} notes={notes} cumulative={false} /></div>)}</div>}
  </div>;
}
