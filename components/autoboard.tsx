"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, Mic, PanelTop, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiveClassroom } from './live-classroom';
import { type LessonSource } from './auto-board';
import { LessonLibrary, LessonReview } from './lesson-library';
import type { SavedLesson } from '@/lib/lesson-archive';
import type { SourcePage } from '@/lib/agent';
import { importLessonPdf } from '@/lib/pdf-import';
import { BoardDiagram } from './board-diagram';

function Brand() { return <span className="ab-brand"><PanelTop strokeWidth={2.4} />autoboard</span>; }
function Flow({ step }: { step: number }) { return <ol className="ab-flow" aria-label="수업 진행 순서">{['자료 선택', '자동 판서', '복습 자료'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</li>)}</ol>; }

function Materials({ onBack, onStart }: { onBack: () => void; onStart: (source: LessonSource) => void }) {
  const [name, setName] = useState('');
  const [pages, setPages] = useState<SourcePage[]>([{ page: 1, text: '' }]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [connection, setConnection] = useState<{ configured: boolean; authenticated: boolean } | null>(null);
  const [tab, setTab] = useState('pdf');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const importController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  async function check() {
    try {
      let response = await fetch('/api/status'); let data = await response.json() as { configured: boolean; authenticated: boolean };
      if (!data.authenticated && ['localhost', '127.0.0.1'].includes(location.hostname)) {
        await fetch('/signin-with-chatgpt?return_to=/'); response = await fetch('/api/status'); data = await response.json() as { configured: boolean; authenticated: boolean };
      }
      if (mounted.current) setConnection(data);
    } catch { if (mounted.current) setMessage('서버 연결을 확인하지 못했습니다. 로컬 서버가 실행 중인지 확인해 주세요.'); }
  }
  useEffect(() => { mounted.current = true; void check(); return () => { mounted.current = false; importController.current?.abort(); }; }, []);
  async function upload(file: File, forceOcr = false) {
    if (file.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(file.name)) { setMessage('10MB 이하 PDF를 선택해 주세요.'); return; }
    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    setPdfFile(file); setLoading(true); setMessage('수업 자료를 읽고 있습니다.');
    // A failed replacement must not silently leave the previous lesson selected.
    setPages([{ page: 1, text: '' }]); setName(file.name.replace(/\.pdf$/i, '').slice(0, 80));
    const active = () => mounted.current && importController.current === controller;
    try {
      const result = await importLessonPdf(file, { forceOcr, signal: controller.signal, progress: value => { if (active()) setMessage(value); } });
      if (active()) {
        setPages(result.pages);
        setMessage(result.uncertainPages.length
          ? `자료를 읽었습니다. ${result.uncertainPages.join(', ')}쪽에 판독이 불확실한 부분이 있습니다. 원문과 대조해 수정해 주세요.`
          : result.ocrPages.length
            ? `${result.ocrPages.length}쪽을 이미지로 다시 읽었습니다. 수식·첨자·단위를 원문과 확인해 주세요.`
            : '자료를 읽었습니다. 글자가 깨지거나 읽는 순서가 다르면 이미지로 다시 읽기를 사용해 주세요.');
      }
    } catch (error) {
      if (active()) setMessage(controller.signal.aborted ? '자료 읽기를 취소했습니다. 다시 선택하거나 직접 입력해 주세요.' : error instanceof Error ? error.message : '자료를 읽지 못했습니다.');
    } finally { if (active()) setLoading(false); }
  }
  const cleaned = pages.filter(page => page.text.trim()).map(page => ({ ...page, text: page.text.trim() }));
  const valid = name.trim() && cleaned.length && cleaned.reduce((sum, page) => sum + page.text.length, 0) <= 50000;
  return <div className="ab-shell"><header className="ab-header"><Brand /><Flow step={0} /></header><main className="ab-setup"><Button variant="ghost" onClick={onBack}><ArrowLeft />처음으로</Button><div className="ab-setup-heading"><h1>오늘의 수업 자료를<br />준비해 주세요.</h1><p>교재와 학습지를 바탕으로 선생님의 설명을 정리합니다.</p></div>
    <div className="ab-material-grid"><section className="ab-upload-panel"><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="pdf">PDF 업로드</TabsTrigger><TabsTrigger value="text">직접 입력</TabsTrigger></TabsList><TabsContent value="pdf"><label className="ab-upload-zone"><Upload size={32} /><strong>{loading ? '자료 읽는 중…' : '수업 자료 PDF 선택'}</strong><span>최대 20쪽 · 10MB · 스캔 PDF 지원</span><input type="file" accept="application/pdf" disabled={loading} aria-label="수업 자료 PDF 선택" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label><p className="secondary-note">글자가 깨지거나 스캔된 페이지는 OpenAI 이미지 인식으로 다시 읽습니다.</p><div className="ab-tool-actions">{pdfFile && <Button variant="outline" disabled={loading} onClick={() => void upload(pdfFile, true)}>PDF를 이미지로 다시 읽기</Button>}{loading && <Button variant="outline" onClick={() => importController.current?.abort()}>자료 읽기 취소</Button>}</div></TabsContent><TabsContent value="text"><div className="ab-direct-guide"><FileText size={32} /><h2>필요한 범위만 붙여넣으세요</h2><p>오른쪽 자료 본문에 수업할 내용을 입력하세요. 단원명, 핵심 개념, 수식의 조건을 함께 넣으면 좋습니다.</p></div></TabsContent></Tabs><div className="ab-material-note"><BookOpen size={20} /><p>수업 주제와 관련된 내용은 판서할 수 있습니다. 교재에 직접 없는 내용은 외부 근거를 확인합니다.</p></div><div className="ab-connection"><span>{!connection ? 'AI 연결 확인 중…' : connection.configured && connection.authenticated ? 'AI 연결 준비됨' : !connection.configured ? '서버의 API 키 설정이 필요합니다.' : 'AI 사용을 위해 로그인이 필요합니다.'}</span><Button variant="ghost" onClick={check}>다시 확인</Button>{connection && !connection.authenticated && <a href="/signin-with-chatgpt?return_to=/">로그인</a>}</div></section>
    <section className="ab-material-preview"><label htmlFor="lesson-name">수업 이름</label><input id="lesson-name" maxLength={80} value={name} placeholder="예: 에너지 보존과 운동" onChange={e => setName(e.target.value)} /><div className="ab-preview-heading"><h2>수업 자료 본문</h2><span>{cleaned.length}쪽</span></div><div className="ab-page-editors">{pages.map((page, index) => <label key={page.page}>{page.page}쪽<textarea aria-label={`자료 ${page.page}쪽 본문`} rows={7} maxLength={8000} placeholder="이곳에 수업할 내용을 입력하거나 PDF를 업로드해 주세요." value={page.text} disabled={loading} onChange={e => setPages(previous => previous.map((item, i) => i === index ? { ...item, text: e.target.value } : item))} /></label>)}</div></section></div>
    {message && <p className="ab-feedback" role="status">{message}</p>}<div className="ab-setup-bottom"><p>이미지 인식 시 해당 페이지가, 수업 중에는 음성과 자료가 OpenAI로 전송됩니다.<br />종료한 수업은 이 브라우저에 저장되며, 이전 수업에서 다시 열거나 PDF로 내려받을 수 있습니다.</p><Button size="lg" disabled={!valid || loading || !connection?.configured || !connection?.authenticated} onClick={() => onStart({ name: name.trim(), pages: cleaned })}>자동 판서 화면으로<ArrowRight /></Button></div>
  </main></div>;
}

export function Autoboard() {
  const [phase, setPhase] = useState<'landing' | 'materials' | 'classroom' | 'review' | 'library'>('landing');
  const [source, setSource] = useState<LessonSource | null>(null);
  const [result, setResult] = useState<SavedLesson | null>(null);
  useEffect(() => { window.scrollTo(0, 0); }, [phase]);
  if (phase === 'classroom' && source) return <LiveClassroom source={source} onFinish={value => { setResult({version:1,id:crypto.randomUUID(),result:value,messages:[]}); setPhase('review'); }} />;
  if (phase === 'materials') return <Materials onBack={() => setPhase('landing')} onStart={value => { setSource(value); setPhase('classroom'); }} />;
  if (phase === 'library') return <LessonLibrary onHome={() => setPhase('landing')} onOpen={value => {setResult(value);setPhase('review');}} />;
  if (phase === 'review' && result) return <LessonReview key={result.id} initial={result} onHome={() => setPhase('landing')} onLibrary={() => setPhase('library')} onNew={() => { setResult(null); setSource(null); setPhase('materials'); }} />;
  return <div className="ab-shell"><header className="ab-header"><Brand /><div className="ab-header-actions"><Button variant="ghost" onClick={() => setPhase('library')}>이전 수업</Button><Button variant="outline" onClick={() => setPhase('materials')}>수업 준비하기<ArrowRight /></Button></div></header><main className="ab-landing"><section className="ab-hero-copy"><p className="ab-intro">선생님의 설명을, 교실의 판서로.</p><h1>설명은 선생님이.<br />그림은 autoboard가.</h1><p className="ab-hero-description">교재를 올리고 설명에 집중하세요.<br />핵심은 짧게, 개념은 그림으로 정리하고,<br />수업이 끝나면 복습 자료로 정리합니다.</p><Button size="lg" onClick={() => setPhase('materials')}>수업 자료 선택하기<ArrowRight /></Button><span className="ab-hero-note">별도 설치 없이 브라우저에서 시작하세요.</span></section><section className="ab-landing-board" aria-label="autoboard 수업 흐름 소개"><div className="ab-preview-top"><PanelTop size={20} /><span>설명에서 복습까지</span></div><BoardDiagram visual={{ kind: 'process', nodes: [{ label: '설명', detail: '선생님의 목소리', icon: 'motion' }, { label: '그림 판서', detail: '한눈에 보이는 개념', icon: 'particle' }, { label: '복습', detail: 'PDF로 다시 보기', icon: 'book' }] }} /><div className="ab-preview-caption"><Mic size={20} /><span>말하는 내용은 실시간 자막으로</span></div></section></main><section className="ab-landing-flow"><div><span>1</span><h2>자료를 준비하고</h2><p>PDF를 올리거나 수업 내용을 입력하세요.</p></div><div><span>2</span><h2>설명을 이어가면</h2><p>인식된 내용이 자막과 판서로 연결됩니다.</p></div><div><span>3</span><h2>복습 자료까지</h2><p>수업을 종료하고 판서를 PDF로 저장하세요.</p></div></section><footer className="ab-landing-footer"><Brand /><span>수업의 중심은 선생님과 학생입니다.</span></footer></div>;
}
