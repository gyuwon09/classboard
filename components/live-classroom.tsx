"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize, Mic, MicOff, PanelTop, Pencil, Square, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { boardFrameSchema, type BoardFrame } from '@/lib/agent';
import { SerialLessonQueue } from '@/lib/auto-session';
import { RealtimeClassroom } from '@/lib/realtime-client';
import { AutoBoard, type LessonFrame, type LessonResult, type LessonSource } from './auto-board';
import { useLessonTools } from './use-lesson-tools';
import { LiveCaptions } from './live-captions';
import { boardContentKey, hasCurrentVerification } from '@/lib/board-verification';

export function LiveClassroom({ source, onFinish }: { source: LessonSource; onFinish: (result: LessonResult) => void }) {
  const [frames, setFrames] = useState<LessonFrame[]>([]);
  const framesRef = useRef<LessonFrame[]>([]);
  const transcript = useRef<string[]>([]);
  const notices = useRef<string[]>([]);
  const startedAt = useRef(Date.now());
  const [current, setCurrent] = useState(0);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  const [caption, setCaption] = useState('');
  const [lastCaption, setLastCaption] = useState('');
  const [micState, setMicState] = useState<'off' | 'connecting' | 'on' | 'finishing'>('off');
  const [queued, setQueued] = useState(0);
  const [ending, setEnding] = useState(false);
  const endingRef = useRef(false);
  const mounted = useRef(true);
  const [message, setMessage] = useState('마이크를 켜면 인식된 말이 자막과 판서로 이어집니다.');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [manual, setManual] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editMath, setEditMath] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [removed, setRemoved] = useState<LessonFrame | null>(null);
  const capture = useRef<RealtimeClassroom | null>(null);
  const captureRun = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  const queue = useRef<SerialLessonQueue<BoardFrame> | null>(null);
  const addNotice = (text: string) => { notices.current.push(text); if (mounted.current) setMessage(text); };
  const replaceFrames = (value: LessonFrame[]) => { framesRef.current = value; setFrames(value); };
  if (!queue.current) queue.current = new SerialLessonQueue(async (text, signal) => {
    const response = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ speech: text, pages: source.pages, previousTitles: framesRef.current.slice(-30).map(frame => frame.title) }) });
    const data = await response.json() as { error?: string; frame?: unknown };
    if (!response.ok) throw Error(data.error || '판서를 만들지 못했습니다.');
    return boardFrameSchema.parse(data.frame);
  }, frame => {
    if (!mounted.current) return;
    if (frame.action === 'hold') { addNotice(`판서 보류: ${frame.reason}`); return; }
    if (!hasCurrentVerification(frame)) { addNotice('근거 검증이 없는 응답은 판서하지 않았습니다. 다시 설명해 주세요.'); return; }
    if (frame.recognition?.changes.length) {
      const recognition = frame.recognition;
      setLastCaption(previous => previous === recognition.original ? recognition.corrected : previous);
      notices.current.push(`음성 보정: ${recognition.changes.map(change => `${change.from} → ${change.to}`).join(', ')}`);
    }
    const next = [...framesRef.current, { ...frame, id: crypto.randomUUID(), sourceName: source.name, createdAt: new Date().toISOString() }];
    replaceFrames(next);
    if (followingRef.current) setCurrent(next.length - 1);
    setMessage(frame.recognition?.changes.length ? `음성 보정: ${frame.recognition.changes.map(change => `${change.from} → ${change.to}`).join(', ')} · 판서 반영` : '교재 근거와 사실 검토를 통과한 판서를 추가했습니다.');
  }, error => addNotice(error instanceof Error ? error.message : '판서를 처리하지 못했습니다. 인식된 문장은 기록에 남아 있습니다.'), size => { if (mounted.current) setQueued(size); });

  function sentence(text: string) {
    transcript.current.push(text); setLastCaption(text); setCaption('');
    queue.current!.enqueue(text);
    if (queue.current!.size >= 6 && capture.current) {
      captureRun.current++; capture.current.close(); capture.current = null; setMicState('off');
      addNotice('판서 처리가 밀려 마이크를 잠시 멈췄습니다. 대기 중인 내용이 표시된 뒤 다시 켜 주세요.');
    }
  }
  async function startMic() {
    if (endingRef.current || capture.current) return;
    const run = ++captureRun.current;
    setMicState('connecting'); setMessage('마이크와 실시간 자막을 연결하고 있습니다.');
    const session = new RealtimeClassroom({
      caption: text => { if (mounted.current && run === captureRun.current) setCaption(text); },
      sentence: text => { if (mounted.current && run === captureRun.current) sentence(text); },
      connected: () => { if (mounted.current && run === captureRun.current) { setMicState('on'); setMessage('말씀하세요. 자막과 판서가 자동으로 이어집니다.'); } },
      error: text => { if (mounted.current && run === captureRun.current) addNotice(text); },
      closed: () => { if (mounted.current && run === captureRun.current) { capture.current = null; setMicState('off'); } },
    });
    capture.current = session;
    try { await session.start(); }
    catch (error) {
      session.close();
      if (run === captureRun.current && mounted.current) { capture.current = null; setMicState('off'); addNotice(error instanceof Error && error.name === 'NotAllowedError' ? '마이크 권한이 필요합니다. 주소창에서 마이크를 허용하거나 직접 입력해 주세요.' : error instanceof Error ? error.message : '마이크를 연결하지 못했습니다.'); }
    }
  }
  async function pauseMic() {
    const session = capture.current;
    if (!session) return;
    setMicState('finishing');
    await session.finish();
    if (capture.current === session) capture.current = null;
    if (mounted.current) { setMicState('off'); setCaption(''); }
  }
  function immediateStop() {
    captureRun.current++; capture.current?.close(); capture.current = null;
    queue.current?.cancel(); setMicState('off'); setCaption('');
    addNotice('음성과 대기 중 판서를 중지했습니다. 이미 표시한 판서는 유지됩니다.');
  }
  async function finishLesson() {
    if (endingRef.current || editBusy) return;
    endingRef.current = true; setEnding(true); setMessage('마지막 음성과 판서를 정리하고 있습니다.');
    if (micState === 'connecting') { captureRun.current++; capture.current?.close(); capture.current = null; }
    else await pauseMic();
    await queue.current!.drain();
    if (!mounted.current) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    onFinish({ frames: framesRef.current, transcript: transcript.current, source, startedAt: startedAt.current, endedAt: Date.now(), notices: notices.current });
  }
  async function saveEdit() {
    const original = framesRef.current.find(frame => frame.id === editId);
    if (!original || editBusy) return;
    setEditBusy(true); setEditError('');
    try {
      const { id: _id, sourceName: _name, createdAt: _created, edited: _edited, verification: _verification, ...base } = original;
      const response = await fetch('/api/board/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frame: { ...base, explanation: editText.trim(), latex: editMath }, pages: source.pages }) });
      const data = await response.json() as { error?: string; frame?: unknown };
      if (!response.ok) throw Error(data.error || '수정 내용의 근거 검증에 실패했습니다.');
      const checked = boardFrameSchema.parse(data.frame);
      if (checked.action === 'hold') throw Error(checked.reason);
      if (!hasCurrentVerification(checked)) throw Error('검증 결과가 없어 수정 내용을 반영하지 않았습니다.');
      if (!mounted.current || endingRef.current) return;
      const currentFrame = framesRef.current.find(frame => frame.id === original.id);
      if (!currentFrame || boardContentKey(currentFrame) !== boardContentKey(original)) throw Error('판서가 변경되었습니다. 수정 도구를 다시 열어 주세요.');
      replaceFrames(framesRef.current.map(frame => frame.id === original.id ? { ...frame, ...checked, edited: true } : frame));
      setEditOpen(false); setMessage('수정 내용의 근거를 다시 검토하여 반영했습니다.');
    } catch (error) {
      if (mounted.current) setEditError(error instanceof Error ? error.message : '검증에 실패했습니다. 기존 판서는 유지됩니다.');
    } finally { if (mounted.current) setEditBusy(false); }
  }
  function navigate(index: number) { followingRef.current = false; setFollowing(false); setCurrent(index); }
  useLessonTools({ mode: 'classroom', step: frames.length ? current + 1 : 0, playing: micState === 'on', title: source.name, count: frames.length }, navigate);
  useEffect(() => {
    mounted.current = true;
    const unload = (event: BeforeUnloadEvent) => { if (framesRef.current.length || capture.current) { event.preventDefault(); event.returnValue = ''; } };
    const hidden = () => { if (document.hidden && capture.current && !endingRef.current) { immediateStop(); addNotice('다른 탭으로 이동해 음성 인식과 생성을 멈췄습니다.'); } };
    window.addEventListener('beforeunload', unload); document.addEventListener('visibilitychange', hidden);
    return () => { mounted.current = false; captureRun.current++; capture.current?.close(); queue.current?.cancel(); window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen(); } catch { addNotice('브라우저의 전체 화면 기능을 사용해 주세요.'); } }
  async function openTools() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setToolsOpen(true);
  }
  const activeFrame = frames[current];
  return <div className="ab-classroom" ref={stage}>
    <header className="ab-class-header"><span className="ab-brand"><PanelTop />autoboard</span><span className="ab-source-title">{source.name}</span><span className="ab-live-indicator"><i className={micState === 'on' ? 'on' : ''} />{micState === 'on' ? '음성 인식 중' : micState === 'connecting' ? '연결 중' : '마이크 꺼짐'}</span><Button variant="outline" disabled={ending || editBusy} onClick={openTools}>수업 도구</Button><Button variant="ghost" size="icon" onClick={fullscreen} aria-label="전체 화면 전환"><Maximize /></Button><Button disabled={ending || editBusy} onClick={finishLesson}><Square />{ending ? '수업 마무리 중…' : '수업 종료'}</Button></header>
    <main className="ab-stage"><div className="ab-board-scroll"><AutoBoard frame={activeFrame} previous={frames.slice(Math.max(0, current - 2), current)} number={frames.length ? current + 1 : 0} total={frames.length} /></div>
      <LiveCaptions text={caption || lastCaption} />
    </main>
    <footer className="ab-class-controls"><div className="ab-mic-controls"><Button onClick={micState === 'on' ? pauseMic : startMic} disabled={ending || micState === 'connecting' || micState === 'finishing'}>{micState === 'on' ? <MicOff /> : <Mic />}{micState === 'on' ? '인식 일시정지' : micState === 'connecting' ? '연결 중…' : micState === 'finishing' ? '마지막 음성 처리 중…' : '마이크 켜기'}</Button><Button variant="outline" disabled={!capture.current && !queued} onClick={immediateStop}>즉시 중지</Button></div><p className="ab-session-status" role="status">{queued ? `${queued}개 설명 생성·근거 검토 중` : message}</p><nav className="ab-board-nav" aria-label="판서 이동"><Button variant="ghost" size="icon" disabled={current === 0 || !frames.length} aria-label="이전 판서" onClick={() => navigate(current - 1)}><ArrowLeft /></Button><span>{frames.length ? `${current + 1} / ${frames.length}` : '판서 대기'}</span><Button variant="ghost" size="icon" disabled={current >= frames.length - 1} aria-label="다음 판서" onClick={() => navigate(current + 1)}><ArrowRight /></Button><Button variant={following ? 'secondary' : 'outline'} onClick={() => { followingRef.current = true; setFollowing(true); setCurrent(Math.max(0, frames.length - 1)); }}>{following ? '자동 따라가기' : '최신 판서로'}</Button></nav></footer>
    {ending && <div className="ab-ending" role="status"><span className="ab-spinner" /><h2>수업을 정리하고 있어요</h2><p>남은 음성과 판서를 처리한 뒤 다운로드 화면으로 이동합니다.</p><Button variant="outline" onClick={immediateStop}>남은 처리 중지</Button></div>}
    <Dialog open={toolsOpen} onOpenChange={setToolsOpen}><DialogContent className="lesson-dialog ab-tools"><DialogHeader><DialogTitle>수업 도구</DialogTitle><DialogDescription>음성 인식이 어려울 때 직접 입력하거나, 이미 표시한 판서를 수정할 수 있습니다.</DialogDescription></DialogHeader><label htmlFor="manual-speech">설명 직접 입력</label><textarea id="manual-speech" rows={4} maxLength={2000} value={manual} onChange={e => setManual(e.target.value)} /><Button disabled={ending || manual.trim().length < 3} onClick={() => { sentence(manual.trim()); setManual(''); setToolsOpen(false); }}>바로 판서하기</Button><div className="ab-tool-actions"><Button variant="outline" disabled={!activeFrame || ending} onClick={() => { setEditId(activeFrame.id); navigate(current); setEditText(activeFrame.explanation); setEditMath(activeFrame.latex); setToolsOpen(false); setEditOpen(true); }}><Pencil />현재 판서 수정</Button><Button variant="outline" disabled={!frames.length || ending || queued > 0} onClick={() => { setRemoved(frames.at(-1)!); replaceFrames(frames.slice(0, -1)); setCurrent(Math.max(0, frames.length - 2)); }}><Undo2 />마지막 판서 취소</Button><Button variant="ghost" disabled={!removed || ending} onClick={() => { if (removed) { replaceFrames([...framesRef.current, removed]); setCurrent(framesRef.current.length - 1); setRemoved(null); } }}>취소 복원</Button></div><details><summary>음성 인식 기록 ({transcript.current.length})</summary><div className="ab-transcript-log">{transcript.current.map((text, index) => <p key={index}>{text}</p>)}</div></details><p className="secondary-note">음성과 수업 자료는 OpenAI로 전송됩니다. 원본 음성은 앱에 저장하지 않으며 종료한 수업은 이 브라우저에 저장됩니다.</p></DialogContent></Dialog>
    <Dialog open={editOpen} onOpenChange={value => { if (!editBusy) { setEditOpen(value); setEditError(''); } }}><DialogContent className="lesson-dialog"><DialogHeader><DialogTitle>현재 판서 수정</DialogTitle><DialogDescription>수정한 설명과 수식도 교재·외부 자료 검토를 통과한 뒤 반영합니다.</DialogDescription></DialogHeader><label htmlFor="edit-explanation">설명</label><textarea id="edit-explanation" value={editText} disabled={editBusy} maxLength={180} onChange={e => setEditText(e.target.value)} /><label htmlFor="edit-formula">수식 (LaTeX)</label><input id="edit-formula" value={editMath} disabled={editBusy} maxLength={350} onChange={e => setEditMath(e.target.value)} />{editError && <p role="alert">{editError}</p>}<Button disabled={!editText.trim() || editBusy} onClick={saveEdit}>{editBusy ? '근거 검토 중…' : '검증 후 수정 반영'}</Button></DialogContent></Dialog>
  </div>;
}
