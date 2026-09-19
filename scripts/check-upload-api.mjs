import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Exercise the same PDF text extractor and source shape used by the classroom.
const loading = getDocument({data: new Uint8Array(await readFile('public/earth-worksheet.pdf'))});
const pdf = await loading.promise;
const pages = [];
for (let page = 1; page <= pdf.numPages; page++) {
  const content = await (await pdf.getPage(page)).getTextContent();
  const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
  pages.push({page, text});
}
await loading.destroy();
assert.equal(pages.length, 3);
const base = 'http://localhost:5173';
const signIn = await fetch(`${base}/signin-with-chatgpt?return_to=/`, {redirect:'manual'});
const cookie = signIn.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
assert.ok(cookie);
const headers = {cookie, 'Content-Type':'application/json', Origin:base};
const previousTitles = [];
for (const [name,speech] of [
  ['definition','지구 탈출 속도의 의미를 설명해 주세요. 추가 추진 없이 무한히 멀어지는 최소 초기 속도입니다.'],
  ['energy','운동 에너지는 이분의 일 mv 제곱이고 중력 퍼텐셜 에너지는 마이너스 GMm/R입니다. 전체 에너지를 식으로 정리해 주세요.'],
  ['derivation','물체의 질량 m을 약분하고 양의 제곱근을 취하면 지구 탈출 속도는 루트 2GM/R입니다. 이 공식을 써 주세요.'],
]) {
  const response = await fetch(`${base}/api/board`,{method:'POST', headers, body:JSON.stringify({speech,pages,previousTitles})});
  const data = await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.frame.action,'ready',JSON.stringify(data));
  assert.ok(pages.some(page=>page.page===data.frame.sourcePage && page.text.includes(data.frame.quote)));
  if(name==='definition') assert.equal(data.frame.latex,'');
  else assert.ok(data.frame.latex.length>0);
  previousTitles.push(data.frame.title);
  console.log(JSON.stringify({case:name,status:response.status,sourcePage:data.frame.sourcePage,title:data.frame.title,latex:data.frame.latex,exactQuote:true}));
}
