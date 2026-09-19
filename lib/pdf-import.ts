import { pdfTextProblem } from './pdf-text-quality';
import type { SourcePage } from './agent';
import { parallelPages } from './parallel-pages';

export async function importLessonPdf(file: File, options: { forceOcr?: boolean; signal: AbortSignal; progress: (message: string) => void }) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  options.signal.throwIfAborted();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const cancel = () => { void task.destroy().catch(() => {}); };
  options.signal.addEventListener('abort', cancel, { once: true });
  const ocrPages: number[] = [], uncertainPages: number[] = [];
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 20) throw Error('이번 수업 범위를 20쪽 이하로 나누어 주세요.');
    let completed = 0, characters = 0;
    const pages: SourcePage[] = await parallelPages(pdf.numPages, options.signal, async (number, signal) => {
      signal.throwIfAborted();
      const page = await pdf.getPage(number);
      try {
      let text = '';
      try {
        const content = await page.getTextContent();
        text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
      } catch { signal.throwIfAborted(); }
      if (options.forceOcr || pdfTextProblem(text)) {
        options.progress(`${completed} / ${pdf.numPages}쪽 완료 · 최대 3쪽 동시 이미지 인식 중`);
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2400 / Math.max(original.width, original.height), 3) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          const render = page.render({ canvas, viewport, background: '#ffffff' });
          const cancelRender = () => render.cancel();
          signal.addEventListener('abort', cancelRender, { once: true });
          try { if (signal.aborted) render.cancel(); await render.promise; }
          finally { signal.removeEventListener('abort', cancelRender); }
          signal.throwIfAborted();
          const response = await fetch('/api/materials/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(100000)]), body: JSON.stringify({ page: number, image: canvas.toDataURL('image/jpeg', 0.95) }) });
          const result = await response.json() as { text?: string; uncertain?: boolean; error?: string };
          if (!response.ok) throw Error(`${number}쪽: ${result.error || '이미지를 읽지 못했습니다.'}`);
          if (typeof result.text !== 'string' || (result.text.trim() && pdfTextProblem(result.text) === 'encoding')) throw Error(`${number}쪽의 문자 복원에 실패했습니다. 내용을 직접 입력해 주세요.`);
          text = result.text.trim(); ocrPages.push(number);
          if (result.uncertain || text.includes('[판독 불가]')) uncertainPages.push(number);
        } finally { canvas.width = 0; canvas.height = 0; }
      }
      if (text.length > 8000) throw Error(`${number}쪽이 너무 깁니다. 필요한 내용을 직접 입력해 주세요.`);
      signal.throwIfAborted();
      characters += text.length;
      if (characters > 50000) throw Error('자료는 총 50,000자까지 사용할 수 있습니다.');
      options.progress(`${++completed} / ${pdf.numPages}쪽 읽기 완료`);
      return { page: number, text };
      } finally { page.cleanup(); }
    });
    if (!pages.some(page => page.text.length >= 8)) throw Error('읽을 수 있는 본문이 없습니다. 더 선명한 PDF를 선택하거나 내용을 직접 입력해 주세요.');
    return { pages, ocrPages: ocrPages.sort((a,b)=>a-b), uncertainPages: uncertainPages.sort((a,b)=>a-b) };
  } finally {
    options.signal.removeEventListener('abort', cancel);
    await task.destroy().catch(() => {});
  }
}
