"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Download, Send, FileText, PanelTop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoBoard } from './auto-board';
import { listLessons, saveLesson, summarySchema, chatMessageSchema, type SavedLesson, type LessonSummary } from '@/lib/lesson-archive';
import { buildReviewPdf, buildSummaryPdf } from '@/lib/pdf-export';
import { ChatContent } from './chat-content';

const errorText = (error: unknown) => error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해 주세요.';
const dateText = (value:number) => new Date(value).toLocaleString('ko-KR');
export function ArchiveHeader({onHome}:{onHome:()=>void}) {return <header className="ab-header"><span className="ab-brand"><PanelTop/>autoboard</span><Button variant="outline" onClick={onHome}><ArrowLeft/>처음으로</Button></header>;}
export function LessonLibrary({onHome,onOpen}:{onHome:()=>void;onOpen:(lesson:SavedLesson)=>void}) {
  const [lessons,setLessons]=useState<SavedLesson[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState('');
  async function load(){setLoading(true);setError('');try{const result=await listLessons();setLessons(result.lessons);if(result.invalid)setError(`읽을 수 없는 기록 ${result.invalid}개가 있습니다. 나머지 수업을 표시합니다.`);}catch(e){setError(errorText(e));}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  const filtered=lessons.filter(lesson=>lesson.result.source.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="ab-shell"><ArchiveHeader onHome={onHome}/><main className="ab-library"><p className="ab-intro">LESSON LIBRARY</p><h1>이전 수업</h1><p className="ab-library-lead">지난 설명을 다시 읽고, 궁금한 내용을 이어서 질문하세요.</p><p className="ab-storage-note">이 브라우저에 저장된 기록입니다. 다른 기기와 동기화되지 않으며 사이트 데이터를 삭제하면 사라집니다.</p><label className="ab-search">수업 이름 검색<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="찾고 싶은 수업 이름"/></label>{error&&<div role="alert" className="ab-feedback">{error}<Button variant="outline" onClick={load}>다시 불러오기</Button></div>}{loading?<p role="status">수업 기록을 불러오는 중…</p>:!filtered.length?<div className="ab-library-empty"><BookOpen size={32}/><h2>{query?'검색 결과가 없습니다.':'아직 저장된 수업이 없습니다.'}</h2><p>수업을 종료하면 판서와 수업 자료가 여기에 저장됩니다.</p></div>:<div className="ab-lesson-list">{filtered.map(lesson=><button className="ab-lesson-card" key={lesson.id} onClick={()=>onOpen(lesson)}><span>{dateText(lesson.result.endedAt)}</span><h2>{lesson.result.source.name}</h2><p>판서 {lesson.result.frames.length}쪽 · {Math.max(1,Math.round((lesson.result.endedAt-lesson.result.startedAt)/60000))}분</p><span className="ab-card-link">수업 결과 · PDF · AI 질문 →</span></button>)}</div>}</main></div>;
}

function SummaryPages({summary,name,date}:{summary:LessonSummary;name:string;date:number}) {
  return <><section className="summary-pdf-page"><header>autoboard / 수업 요약</header><p>{dateText(date)}</p><h1>{name}</h1><h2>한눈에 보는 수업</h2><p>{summary.overview}</p><p>{summary.sections.length}개의 핵심 개념을 근거와 함께 정리했습니다.</p><footer>AI가 수업 기록을 바탕으로 정리했습니다. 세부 내용은 교재 근거와 함께 확인하세요. · 1 / {summary.sections.length+1}</footer></section>{summary.sections.map((section,index)=><section className="summary-pdf-page" key={index}><header>autoboard / {name}</header><p>핵심 개념 {String(index+1).padStart(2,'0')}</p><h2>{section.title}</h2><div className="summary-pdf-body">{section.body}</div><footer>근거: {[...new Set(section.citations.map(c=>c.label.split(':')[0]))].join(' · ')}<br/>{index+2} / {summary.sections.length+1}</footer></section>)}</>;
}

export function LessonReview({initial,onHome,onLibrary,onNew}:{initial:SavedLesson;onHome:()=>void;onLibrary:()=>void;onNew:()=>void}) {
  const [lesson,setLesson]=useState(initial),[saveStatus,setSaveStatus]=useState('저장 중…'),[saveError,setSaveError]=useState(false);
  const [busy,setBusy]=useState<'summary'|'chat'|null>(null),[exporting,setExporting]=useState(false),[message,setMessage]=useState(''),[question,setQuestion]=useState(''),[tab,setTab]=useState<'summary'|'boards'|'chat'>('summary');
  const [boardIndex,setBoardIndex]=useState(0);
  const pdfRoot=useRef<HTMLDivElement>(null),summaryRoot=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null),live=useRef(true),chatEnd=useRef<HTMLDivElement>(null);
  const result=lesson.result;
  useEffect(()=>{live.current=true;return()=>{live.current=false;controller.current?.abort();};},[]);
  // Serialize persistence so a slower earlier write cannot overwrite a newer summary/chat.
  const writes=useRef(Promise.resolve());
  function persist(value:SavedLesson){setSaveStatus('저장 중…');setSaveError(false);writes.current=writes.current.catch(()=>{}).then(()=>saveLesson(value));void writes.current.then(()=>{if(live.current)setSaveStatus('이 브라우저에 저장됨');}).catch(e=>{if(live.current){setSaveStatus(errorText(e));setSaveError(true);}});}
  useEffect(()=>{persist(lesson);},[lesson]);
  useEffect(()=>{if(tab==='chat')chatEnd.current?.scrollIntoView({block:'nearest'});},[lesson.messages.length,tab,busy]);
  async function study(mode:'summary'|'chat') {
    if(busy || (mode==='chat'&&!question.trim()))return;
    const submitted=question.trim(); setBusy(mode);setMessage('');
    const abort=new AbortController();controller.current=abort;
    try {
      const response=await fetch('/api/lesson/study',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,lesson:result,question:submitted,messages:lesson.messages.slice(-20)})});
      const data=await response.json() as {error?:string;summary?:unknown;message?:unknown};if(!response.ok)throw Error(data.error||'AI 요청에 실패했습니다.');
      if(!live.current)return;
      if(mode==='summary'){const summary=summarySchema.parse(data.summary);setLesson(previous=>({...previous,summary}));setMessage('요약 정리가 준비되었습니다. 아래에서 PDF를 다운로드하세요.');}
      else {const reply=chatMessageSchema.parse(data.message);setLesson(previous=>({...previous,messages:[...previous.messages,{role:'user',content:submitted},reply]}));setQuestion('');}
    }catch(e){if(live.current)setMessage(errorText(e));}finally{if(live.current)setBusy(null);}
  }
  async function download(kind:'boards'|'summary') {
    const root=kind==='boards'?pdfRoot.current:summaryRoot.current;if(!root||exporting)return;
    setExporting(true);setMessage('PDF를 만들고 있습니다…');
    try{const pdf=kind==='boards'?await buildReviewPdf(root,page=>setMessage(`판서 ${page} / ${result.frames.length}쪽 저장 중…`)):await buildSummaryPdf(root);pdf.save(`${result.source.name.replace(/[\\/:*?"<>|]/g,'-')}-${kind==='boards'?'판서':'요약정리'}.pdf`);setMessage('PDF를 저장했습니다. 다운로드 목록을 확인하세요.');}catch(e){setMessage(errorText(e));}finally{setExporting(false);}
  }
  return <div className="ab-shell"><ArchiveHeader onHome={onHome}/><main className="ab-library ab-result"><Button variant="ghost" onClick={onLibrary}><ArrowLeft/>이전 수업 목록</Button><p className="ab-intro">수업 결과 · {dateText(result.endedAt)}</p><h1>{result.source.name}</h1><p className="ab-library-lead">판서 {result.frames.length}쪽 · 수업 내용을 정리하고 질문하며 복습하세요.</p><div className="ab-save-status" role="status">{saveStatus}{saveError&&<Button variant="outline" onClick={()=>persist(lesson)}>저장 다시 시도</Button>}</div><p className="ab-storage-note">이 브라우저에만 저장됩니다. 중요한 수업은 PDF로도 보관하세요.</p>
    <div className="ab-download-grid"><section className="ab-download"><FileText/><div><h2>판서 PDF</h2><p>수업 중의 그림과 설명을 그대로</p></div><Button disabled={!result.frames.length||exporting} onClick={()=>download('boards')}><Download/>판서 PDF 다운로드</Button></section><section className="ab-download"><BookOpen/><div><h2>요약 정리 PDF</h2><p>핵심 개념과 조건을 읽기 쉽게</p></div>{lesson.summary?<Button disabled={exporting} onClick={()=>download('summary')}><Download/>요약 정리 PDF 다운로드</Button>:<Button disabled={!!busy} onClick={()=>study('summary')}>{busy==='summary'?'요약 생성 중…':'요약 정리 만들기'}</Button>}</section></div>
    {message&&<p className="ab-feedback" role="status">{message}</p>}
    <nav className="ab-review-tabs" aria-label="수업 결과 보기">{([['summary','요약 정리'],['boards','판서 다시 보기'],['chat','AI에게 질문']] as const).map(([value,label])=><Button key={value} variant={tab===value?'default':'ghost'} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</Button>)}</nav>
    {tab==='summary'&&<section className="ab-study-summary" aria-label="수업 요약">{lesson.summary?<><p className="ab-summary-overview">{lesson.summary.overview}</p>{lesson.summary.sections.map((section,index)=><article key={index}><span>{String(index+1).padStart(2,'0')}</span><div><h2>{section.title}</h2><p>{section.body}</p><details><summary>교재·판서 근거 확인</summary>{section.citations.map(c=><blockquote key={c.id}><b>{c.label}</b><p>{c.text}</p></blockquote>)}</details></div></article>)}<small>AI 요약은 틀릴 수 있습니다. 근거와 함께 확인하세요.</small></>:<div className="ab-library-empty"><BookOpen/><h2>수업의 핵심을 한 번에</h2><p>‘요약 정리 만들기’를 누르면 수업 기록을 정리합니다.</p></div>}</section>}
    {tab==='boards'&&<section className="ab-archived-board">{result.frames.length?<><div className="ab-board-pager"><Button variant="outline" disabled={boardIndex===0} onClick={()=>setBoardIndex(i=>i-1)}>이전 판서</Button><span>{boardIndex+1} / {result.frames.length}</span><Button variant="outline" disabled={boardIndex===result.frames.length-1} onClick={()=>setBoardIndex(i=>i+1)}>다음 판서</Button></div><AutoBoard frame={result.frames[boardIndex]} number={boardIndex+1} total={result.frames.length}/></>:<p>이 수업에는 생성된 판서가 없습니다. 자료 기반 요약과 질문은 이용할 수 있습니다.</p>}</section>}
    {tab==='chat'&&<section className="ab-study-chat" aria-label="수업 질문"><div className="ab-chat-intro"><h2>이 수업에 대해 물어보세요.</h2><p>자료와 판서를 근거로 답하며, 최근 20개 대화를 참고합니다. 질문과 수업 기록은 OpenAI로 전송됩니다.</p></div><div className="ab-chat-messages" role="log" aria-label="질문과 답변" aria-live="polite">{!lesson.messages.length&&<p className="ab-chat-empty">예: “오늘 배운 개념을 쉽게 설명해 줘.” “두 개념의 차이가 뭐야?”</p>}{lesson.messages.map((item,index)=><article className={`ab-chat-message ${item.role}`} key={index}><strong>{item.role==='user'?'나':'autoboard'}</strong><ChatContent text={item.content}/>{!!item.citations?.length&&<details><summary>답변 근거 {item.citations.length}개</summary>{item.citations.map(c=><blockquote key={c.id}><b>{c.label}</b><ChatContent text={c.text}/></blockquote>)}</details>}</article>)}{busy==='chat'&&<p role="status">수업 자료를 확인하고 있습니다…</p>}<div ref={chatEnd}/></div><form onSubmit={e=>{e.preventDefault();void study('chat');}}><label htmlFor="lesson-question">질문</label><div className="ab-chat-compose"><textarea id="lesson-question" value={question} maxLength={2000} rows={2} disabled={busy==='chat'} onChange={e=>setQuestion(e.target.value)} placeholder="이 수업에서 궁금한 점을 입력하세요"/><Button type="submit" disabled={!!busy||!question.trim()}><Send/>질문 보내기</Button></div></form></section>}
    <details className="ab-review-notices"><summary>수업 자료와 인식 기록</summary>{result.source.pages.map(page=><article key={page.page}><h3>자료 {page.page}쪽</h3><p className="ab-preserve">{page.text}</p></article>)}<h3>음성 인식 원문 · 오류가 포함될 수 있습니다</h3>{result.transcript.map((text,i)=><p key={i}>{text}</p>)}{result.notices.map((text,i)=><p key={`n${i}`}>{text}</p>)}</details><Button variant="outline" onClick={onNew}>새 수업 준비하기</Button>
  </main><div className="pdf-render-root" ref={pdfRoot} aria-hidden="true">{result.frames.map((frame,index)=><div className="pdf-page live-pdf-page" key={frame.id}><AutoBoard frame={frame} number={index+1} total={result.frames.length}/></div>)}</div>{lesson.summary&&<div className="summary-render-root" ref={summaryRoot} aria-hidden="true"><SummaryPages summary={lesson.summary} name={result.source.name} date={result.endedAt}/></div>}</div>;
}
