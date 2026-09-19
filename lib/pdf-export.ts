export async function buildReviewPdf(root: HTMLElement, onProgress: (page: number) => void) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'Classboard lesson notes', author: 'Classboard' });
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
