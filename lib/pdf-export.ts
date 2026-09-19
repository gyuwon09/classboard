export async function buildReviewPdf(root: HTMLElement, onProgress: (page: number) => void) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'autoboard lesson notes', author: 'autoboard' });
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.pdf-page'));
  if (!pages.length) throw new Error('저장할 판서가 없습니다.');
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    await Promise.all(Array.from(page.querySelectorAll('img')).map(image => image.decode()));
    if (!page.offsetWidth || !page.offsetHeight) throw new Error('판서 화면을 확인한 뒤 다시 저장해 주세요.');
    const jpeg = await toJpeg(page, { pixelRatio: 2, quality: 0.94, backgroundColor: '#091b2b' });
    if (i) pdf.addPage();
    const width = Math.min(277, 195 * page.offsetWidth / page.offsetHeight);
    const height = width * page.offsetHeight / page.offsetWidth;
    pdf.addImage(jpeg, 'JPEG', (297 - width) / 2, (210 - height) / 2, width, height);
    onProgress(i + 1);
  }
  return pdf;
}

export async function buildSummaryPdf(root: HTMLElement) {
  const [{toJpeg},{jsPDF}]=await Promise.all([import('html-to-image'),import('jspdf')]);
  await document.fonts.ready;
  const sources=Array.from(root.querySelectorAll<HTMLElement>('.summary-pdf-page'));
  if(!sources.length)throw Error('먼저 요약 정리를 만들어 주세요.');
  const staging=document.createElement('div');root.appendChild(staging);
  const pages: HTMLElement[]=[];
  let flow:HTMLElement;
  function newPage() {
    const page=document.createElement('section');page.className='summary-pdf-page';
    const header=document.createElement('header');header.textContent='autoboard / 수업 요약 정리';
    flow=document.createElement('div');flow.className='summary-pdf-flow';
    const footer=document.createElement('footer');page.appendChild(header);page.appendChild(flow);page.appendChild(footer);staging.appendChild(page);pages.push(page);
  }
  try {
    newPage();
    for(const source of sources) {
      const block=document.createElement('article');block.style.marginBottom='28px';
      for(const child of Array.from(source.children))if(!['HEADER','FOOTER'].includes(child.tagName))block.appendChild(child.cloneNode(true));
      const citation=source.querySelector('footer')?.textContent?.split(/\d+ \/ \d+$/)[0];
      if(citation?.startsWith('근거:')){const note=document.createElement('p');note.className='summary-citation';note.textContent=citation;block.appendChild(note);}
      flow!.appendChild(block);
      if(flow!.scrollHeight>flow!.clientHeight+1 && flow!.children.length>1){block.remove();newPage();flow!.appendChild(block);}
      for(let size=18;flow!.scrollHeight>flow!.clientHeight+1&&size>=13;size--){block.style.fontSize=`${size}px`;block.querySelectorAll<HTMLElement>('.summary-pdf-body').forEach(body=>{body.style.fontSize=`${size}px`;});}
      if(flow!.scrollHeight>flow!.clientHeight+1)throw Error('요약 내용이 페이지를 초과했습니다. 화면의 요약 내용을 확인해 주세요.');
    }
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    pdf.setProperties({title:'autoboard lesson summary',author:'autoboard'});
    for(let i=0;i<pages.length;i++){
      pages[i].querySelector('footer')!.textContent=`AI 요약 · 교재 근거와 함께 확인하세요.                         ${i+1} / ${pages.length}`;
      const jpeg=await toJpeg(pages[i],{pixelRatio:2,quality:0.95,backgroundColor:'#ffffff'});
      if(i)pdf.addPage();pdf.addImage(jpeg,'JPEG',0,0,210,297);
    }
    return pdf;
  } finally { staging.remove(); }
}
