import { BUILTIN_PAGES } from '../lib/lesson.ts';
const base='http://localhost:5173';
const signIn=await fetch(`${base}/signin-with-chatgpt?return_to=/`,{redirect:'manual'});
const cookie=signIn.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
if(!cookie) throw Error('Local sign-in did not return a session');
const headers={cookie,'Content-Type':'application/json',Origin:base};
for(const [name,speech] of [
 ['normal','운동 에너지는 이분의 일 mv 제곱이고, 중력 퍼텐셜 에너지는 마이너스 GMm/R입니다. 출발할 때 전체 에너지를 식으로 정리해 주세요.'],
 ['unit-conflict','지구 표면 탈출 속도는 11.2 m/s입니다.'],
 ['outside-source','광합성의 명반응과 암반응 과정을 설명해 주세요.']
]){
 const start=Date.now();
 const response=await fetch(`${base}/api/board`,{method:'POST',headers,body:JSON.stringify({speech,pages:BUILTIN_PAGES,previousTitles:[]})});
 const data=await response.json();
 console.log(JSON.stringify({case:name,status:response.status,elapsedMs:Date.now()-start,...data}));
}
