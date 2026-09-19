"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Download, Mic, Square, Upload, Check, X, RotateCcw, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EarthFigure, Formula, Explanation } from '@/components/lesson-board';
import { BUILTIN_PAGES } from '@/lib/lesson';
import { boardFrameSchema, type BoardFrame, type SourcePage } from '@/lib/agent';
import { buildReviewPdf } from '@/lib/pdf-export';

type ApprovedFrame = BoardFrame & { id: string; sourceName: string; approvedAt: string };
type Connection = { configured: boolean; authenticated: boolean };
function LiveBoard({ frame, number, total }: { frame?: ApprovedFrame; number: number; total: number }) {
  if (!frame) return <section className="teaching-board live-empty" aria-label="실시간 판서"><BookOpen size={40} /><h2>설명을 판서로 연결하세요</h2><p>수업 자료를 확인하고 교사의 설명을 입력하세요.<br />AI가 제안한 내용을 확인하면 이곳에 표시됩니다.</p><p className="board-source">예제 수업의 판서가 자동으로 섞이지 않습니다.</p></section>;
  return <section className="teaching-board live-board" aria-label="실시간 판서">
    <div className="board-topline"><span>교사가 확인한 판서</span><span>{number} / {total}</span></div><h2>{frame.title}</h2>
    <div className={frame.diagram === 'earth' ? 'board-body' : 'text-board-body'}>
      {frame.diagram === 'earth' && <div className="earth-column"><EarthFigure /></div>}
      <div className="derivation"><Explanation text={frame.explanation} />
        {frame.latex && <div className="equation-row active-equation"><Formula latex={frame.latex} /></div>}
        <div className="board-citation"><p>근거: {frame.sourceName} {frame.sourcePage}쪽</p><blockquote>{frame.quote.length > 160 ? frame.quote.slice(0, 160) + '…' : frame.quote}</blockquote></div>
      </div>
    </div>
    <div className="board-assumptions">{frame.diagram === 'earth' ? '구대칭 지구의 지표면 출발 · 추가 추진 없음 · 공기 저항, 자전, 다른 천체의 영향 무시' : '등록 자료에 근거한 판서 · 교사 확인 후 반영'}</div>
  </section>;
}

export function LiveClassroom({ active }: { active: boolean }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [pages, setPages] = useState<SourcePage[]>([...BUILTIN_PAGES]);
  const [sourceName, setSourceName] = useState('지구 탈출 속도 학습지');
  const [speech, setSpeech] = useState('');
  const [frames, setFrames] = useState<ApprovedFrame[]>([]);
  const [current, setCurrent] = useState(0);
  const [pending, setPending] = useState<BoardFrame | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<SourcePage[]>([]);
  const [draftName, setDraftName] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [lastRemoved, setLastRemoved] = useState<ApprovedFrame | null>(null);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pdfRoot = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  async function fullScreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch { setMessage('전체 화면을 열지 못했습니다. 브라우저의 전체 화면 기능을 사용해 주세요.'); }
  }

  async function checkConnection() {
    try { const response = await fetch('/api/status', { cache: 'no-store' }); if (!response.ok) throw Error(); setConnection(await response.json()); }
    catch { setConnection(null); setMessage('연결 상태를 확인하지 못했습니다. 다시 확인해 주세요.'); }
  }
  function cancel() {
    generation.current += 1; abort.current?.abort(); abort.current = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null; setRecording(false); setBusy(false); setPending(null);
  }
  useEffect(() => { if (active) void checkConnection(); else cancel(); }, [active]);
  useEffect(() => () => { generation.current += 1; abort.current?.abort(); recorder.current?.state === 'recording' && recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) { cancel(); setMessage('다른 화면으로 이동해 녹음과 생성을 중지했습니다.'); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setSeconds(value => value + 1), 1000);
    const timeout = window.setTimeout(() => recorder.current?.state === 'recording' && recorder.current.stop(), 30000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [recording]);

  async function suggest(text = speech, token?: number) {
    const run = token ?? ++generation.current;
    if (!text.trim() || frames.length >= 30) { setMessage('설명을 입력해 주세요. 한 수업은 최대 30개 판서까지 지원합니다.'); return; }
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setPending(null); setMessage('자료와 설명을 대조하고 있습니다.');
    try {
      const response = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ speech: text, pages, previousTitles: frames.map(frame => frame.title) }) });
      const data = await response.json() as { error?: string; frame?: unknown };
      if (run !== generation.current) return;
      if (!response.ok) throw Error(data.error || '판서를 생성하지 못했습니다.');
      const frame = boardFrameSchema.parse(data.frame);
      if (frame.action === 'hold') { setMessage(`판서 보류: ${frame.reason}`); return; }
      setPending(frame); setMessage('제안된 판서와 자료 근거를 확인해 주세요.');
    } catch (error) { if (run === generation.current) setMessage(error instanceof Error && error.name === 'AbortError' ? '판서 생성을 중지했습니다.' : error instanceof Error ? error.message : '연결 오류가 발생했습니다.'); }
    finally { if (run === generation.current) setBusy(false); }
  }
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setMessage('이 브라우저는 녹음을 지원하지 않습니다. 설명을 직접 입력해 주세요.'); return; }
    const run = ++generation.current;
    setMessage('마이크 사용 권한을 확인하고 있습니다.'); setBusy(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (run !== generation.current) { mediaStream.getTracks().forEach(track => track.stop()); return; }
      stream.current = mediaStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      recorder.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      mediaRecorder.onerror = () => { cancel(); setMessage('녹음이 중단되었습니다. 마이크를 확인하거나 직접 입력해 주세요.'); };
      mediaRecorder.onstop = async () => {
        mediaStream.getTracks().forEach(track => track.stop());
        if (run !== generation.current) return;
        setRecording(false); setBusy(true); setMessage('음성을 텍스트로 바꾸고 있습니다.');
        const controller = new AbortController(); abort.current = controller;
        try {
          const type = mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type });
          const form = new FormData(); form.append('audio', blob, type.includes('mp4') ? 'lesson.mp4' : 'lesson.webm');
          const response = await fetch('/api/transcribe', { method: 'POST', body: form, signal: controller.signal });
          const data = await response.json() as { error?: string; text?: string };
          if (run !== generation.current) return;
          if (!response.ok) throw Error(data.error || '음성을 인식하지 못했습니다.');
          if (typeof data.text !== 'string' || !data.text.trim()) throw Error('인식된 문장이 없습니다. 다시 녹음해 주세요.');
          setSpeech(data.text); await suggest(data.text, run);
        } catch (error) { if (run === generation.current) { setBusy(false); setMessage(error instanceof Error ? error.message : '음성을 처리하지 못했습니다.'); } }
      };
      mediaRecorder.start(); setSeconds(0); setRecording(true); setBusy(false); setPending(null); setMessage('녹음 중입니다. 한 개념을 설명한 뒤 녹음 완료를 누르세요. 최대 30초입니다.');
    } catch { if (run === generation.current) { setBusy(false); stream.current?.getTracks().forEach(track => track.stop()); setMessage('마이크를 사용할 수 없습니다. 브라우저 권한을 확인하거나 아래에 직접 입력해 주세요.'); } }
  }

  function approve() {
    if (!pending) return;
    const frame = { ...pending, id: crypto.randomUUID(), sourceName, approvedAt: new Date().toISOString() };
    setFrames(previous => [...previous, frame]);
    // New suggestions wait at the end of the lesson, preserving the page students are reading.
    if (!frames.length) setCurrent(0);
    setPending(null); setMessage('판서를 추가했습니다. 다음 판서 버튼으로 설명할 때 보여주세요.');
  }
  function openSources() { cancel(); setSourceDraft(pages.map(page => ({ ...page }))); setDraftName(sourceName); setSourceOpen(true); setMessage(''); }
  async function readPdf(file: File) {
    if (file.size > 10 * 1024 * 1024 || file.type !== 'application/pdf') { setMessage('10MB 이하 PDF를 선택해 주세요.'); return; }
    setLoadingSource(true); setMessage('PDF에서 텍스트를 읽고 있습니다.');
    let task: { destroy: () => Promise<void> } | undefined;
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const loading = pdfjs.getDocument({ data: await file.arrayBuffer() }); task = loading;
      const pdf = await loading.promise;
      if (pdf.numPages > 20) throw Error('수업 범위를 20쪽 이하 PDF로 나누어 주세요.');
      const extracted: SourcePage[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i); const content = await page.getTextContent();
        const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        if (text.length > 8000) throw Error(`${i}쪽의 텍스트가 너무 많습니다. 수업에 필요한 부분만 직접 입력해 주세요.`);
        extracted.push({ page: i, text });
      }
      if (!extracted.some(page => page.text.length > 10)) throw Error('텍스트를 추출하지 못했습니다. 스캔 자료는 필요한 내용을 직접 입력해 주세요.');
      if (extracted.reduce((sum, page) => sum + page.text.length, 0) > 50000) throw Error('자료는 총 50,000자까지 사용할 수 있습니다. 수업 범위를 줄여 주세요.');
      setSourceDraft(extracted); setDraftName(file.name.replace(/\.pdf$/i, '').slice(0, 80));
      setMessage('수식·기호가 정확하게 추출되었는지 확인한 뒤 적용해 주세요. 빈 페이지는 제외됩니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : '자료를 읽지 못했습니다. 직접 입력할 수 있습니다.'); }
    finally { await task?.destroy(); setLoadingSource(false); }
  }
  function saveSource() {
    const cleaned = sourceDraft.filter(page => page.text.trim()).map(page => ({ ...page, text: page.text.trim() }));
    if (!cleaned.length || !draftName.trim() || cleaned.reduce((sum, page) => sum + page.text.length, 0) > 50000) { setMessage('자료 이름과 본문을 확인해 주세요. 총 50,000자 이내로 입력할 수 있습니다.'); return; }
    setPages(cleaned); setSourceName(draftName.trim()); setSourceOpen(false); setMessage('자료를 적용했습니다. 기존 판서는 원래 근거를 유지합니다.');
  }
  async function exportLesson() {
    if (!pdfRoot.current || !frames.length || exporting) return;
    cancel(); setExporting(true); setExportProgress(0); setMessage('복습 PDF를 만들고 있습니다.');
    try { const pdf = await buildReviewPdf(pdfRoot.current, setExportProgress); pdf.save('classboard-lesson.pdf'); setMessage('PDF를 만들었습니다. 브라우저 다운로드 목록을 확인하세요.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'PDF 생성에 실패했습니다. 다시 시도해 주세요.'); }
    finally { setExporting(false); }
  }
  const available = !!connection?.configured && !!connection?.authenticated;
  return <><div className="teaching-layout live-layout"><section className="board-column">
    <div className="board-toolbar"><span>실시간 판서</span><span>수업 중 자료는 이 탭에서 유지됩니다</span><Button variant="ghost" disabled={!frames.length || exporting || busy || recording} onClick={exportLesson}><Download />{exporting ? `${exportProgress}/${frames.length}쪽 저장 중` : '복습 PDF'}</Button></div>
    <div ref={stageRef} className="presentation-surface">
    <div className="board-toolbar"><span>교사가 넘길 때 다음 판서가 표시됩니다</span><Button variant="ghost" size="icon" aria-label="실시간 판서 전체 화면 전환" onClick={fullScreen}><Maximize size={18} /></Button></div>
    <div className="board-scroll"><LiveBoard frame={frames[current]} number={current + 1} total={frames.length} /></div>
    <div className="step-navigation"><Button variant="outline" disabled={!frames.length || current === 0} onClick={() => setCurrent(current - 1)}><ArrowLeft />이전 판서</Button><span>{frames.length ? `${current + 1} / ${frames.length}` : '판서 대기'}</span><Button disabled={current >= frames.length - 1} onClick={() => setCurrent(current + 1)}>다음 판서<ArrowRight /></Button></div>
    </div>
    {frames.length > 0 && <div className="live-history">{frames.map((frame, i) => <Button key={frame.id} variant={i === current ? 'default' : 'outline'} onClick={() => setCurrent(i)} aria-current={i === current ? 'step' : undefined}>{i + 1}. {frame.title}</Button>)}</div>}
    <div className="edit-actions"><Button variant="ghost" disabled={!frames.length || busy || recording || exporting} onClick={() => { const removed = frames.at(-1)!; setLastRemoved(removed); setFrames(frames.slice(0, -1)); setCurrent(value => Math.max(0, Math.min(value, frames.length - 2))); }}>마지막 판서 취소</Button><Button variant="ghost" disabled={!lastRemoved || frames.length >= 30 || exporting} onClick={() => { if (lastRemoved) setFrames([...frames, lastRemoved]); setLastRemoved(null); }}><RotateCcw />취소 복원</Button></div>
  </section><aside className="teacher-panel live-panel"><div className="panel-heading"><Mic size={18} /><h2>교사 설명 입력</h2></div>
    <div className="connection-notice">{!connection ? 'AI 연결 상태 확인 중' : !connection.configured ? 'AI 연결 설정이 필요합니다. 예제 수업은 바로 사용할 수 있습니다.' : !connection.authenticated ? '실시간 AI 사용을 위해 로그인해 주세요.' : '실시간 AI 연결 설정됨'}<div>{connection && !connection.authenticated && <a href="/signin-with-chatgpt?return_to=/" target="_top">로그인</a>}<Button variant="ghost" size="sm" onClick={checkConnection}>연결 확인</Button></div></div>
    <button className="source-card" onClick={openSources} disabled={exporting}><BookOpen size={20} /><span><strong>{sourceName}</strong><small>{pages.length}쪽 · 자료 확인·변경</small></span></button>
    <section className="panel-section"><div className="recording-actions">{recording ? <Button onClick={() => recorder.current?.stop()}><Square />녹음 완료 ({seconds}초)</Button> : <Button disabled={!available || busy || exporting} onClick={startRecording}><Mic />설명 녹음</Button>}<Button variant="outline" disabled={!recording && !busy && !pending} onClick={() => { cancel(); setMessage('녹음과 생성을 중지했습니다. 기존 판서는 유지됩니다.'); }}><Square />즉시 중지</Button></div><label htmlFor="live-speech">설명 또는 인식된 문장</label><textarea id="live-speech" placeholder="예: 물체의 질량 m을 양변에서 약분하면 탈출 속도는 물체 질량과 무관합니다." value={speech} maxLength={2000} disabled={recording || busy} onChange={event => { setSpeech(event.target.value); setPending(null); }} rows={5} /><Button className="suggest-button" disabled={!available || busy || recording || exporting || speech.trim().length < 3 || frames.length >= 30} onClick={() => suggest()}>{busy ? '자료와 대조 중…' : '설명으로 판서 제안'}</Button><p className="secondary-note">녹음한 음성과 선택한 자료는 인식·판서 생성 시 OpenAI로 전송됩니다. 앱은 원본 음성을 저장하지 않습니다.</p></section>
    {message && <p className="live-message" role="status">{message}</p>}
    {pending && <section className="pending-frame"><h3>판서 제안 · 교사 확인</h3><strong>{pending.title}</strong><textarea aria-label="제안된 설명 수정" value={pending.explanation} maxLength={180} onChange={event => setPending({ ...pending, explanation: event.target.value })} rows={4} />{pending.latex && <Formula latex={pending.latex} />}<label>수식 수정 (LaTeX)<input aria-label="제안된 수식 수정" value={pending.latex} maxLength={350} onChange={event => setPending({ ...pending, latex: event.target.value })} /></label><details><summary>근거 {pending.sourcePage}쪽 확인</summary><blockquote>{pending.quote}</blockquote></details><div className="edit-actions"><Button disabled={!pending.explanation.trim()} onClick={approve}><Check />확인 · 판서 추가</Button><Button variant="outline" onClick={() => { setPending(null); setMessage('제안을 제외했습니다. 설명을 수정해 다시 요청할 수 있습니다.'); }}><X />제외</Button></div></section>}
  </aside></div>
  <Dialog open={sourceOpen} onOpenChange={value => { if (!loadingSource) setSourceOpen(value); }}><DialogContent className="lesson-dialog source-dialog"><DialogHeader><DialogTitle>수업 자료 확인·변경</DialogTitle><DialogDescription>텍스트가 포함된 PDF 20쪽·10MB까지 지원합니다. 수식과 기호를 확인하고 필요한 부분을 직접 수정하세요.</DialogDescription></DialogHeader><label className="upload-button"><Upload size={18} />PDF에서 텍스트 가져오기<input type="file" accept="application/pdf" disabled={loadingSource} onChange={event => { const file = event.target.files?.[0]; if (file) void readPdf(file); event.target.value = ''; }} /></label><label>자료 이름<input value={draftName} maxLength={80} onChange={event => setDraftName(event.target.value)} /></label><div className="source-edit-pages">{sourceDraft.map((page, i) => <label key={page.page}>{page.page}쪽<textarea aria-label={`자료 ${page.page}쪽 본문`} rows={5} maxLength={8000} value={page.text} onChange={event => setSourceDraft(previous => previous.map((item, index) => index === i ? { ...item, text: event.target.value } : item))} /></label>)}</div><Button variant="outline" disabled={loadingSource} onClick={() => { setSourceDraft([{ page: 1, text: '' }]); setDraftName('직접 입력 자료'); }}>새 자료 직접 입력</Button>{message && <p role="status">{message}</p>}<Button disabled={loadingSource} onClick={saveSource}>{loadingSource ? '자료 읽는 중…' : '확인한 자료 적용'}</Button></DialogContent></Dialog>
  {active && frames.length > 0 && <div ref={pdfRoot} className="pdf-render-root" aria-hidden="true">{frames.map((frame, i) => <div className="pdf-page live-pdf-page" key={frame.id}><LiveBoard frame={frame} number={i + 1} total={frames.length} /></div>)}</div>}
  </>;
}
