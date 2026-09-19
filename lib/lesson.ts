export const EARTH_SOURCE = 'https://svs.gsfc.nasa.gov/30613';
export const PHYSICS_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html';
export const CONSTANTS = { G: 6.67430e-11, M: 5.9722e24, R: 6.371e6 };
export function escapeSpeed(mass:number,radius:number){if(!Number.isFinite(mass)||!Number.isFinite(radius)||mass<=0||radius<=0)throw Error('질량과 반지름은 양수여야 합니다.');return Math.sqrt(2*CONSTANTS.G*mass/radius);}
export const LESSON = [
 {title:'탈출의 의미',short:'개념과 조건',heading:'지구를 벗어나려면\n얼마나 빨라야 할까요?',note:'탈출 속도는 추가 추진 없이 무한히 멀어질 수 있는 최소 초기 속도입니다. 멀어져도 중력이 갑자기 사라지지는 않습니다.',speech:'오늘은 지구 표면에서 출발한 물체가 추가 추진 없이 계속 멀어질 수 있는 최소 속도를 알아보겠습니다. 공기 저항과 지구 자전, 다른 천체의 영향은 무시합니다.',latex:'',seconds:22,page:1},
 {title:'두 가지 에너지',short:'운동 + 퍼텐셜',heading:'출발할 때의 에너지를\n두 부분으로 나눕니다.',note:'운동 에너지는 양수, 중력 퍼텐셜 에너지는 음수입니다. 퍼텐셜 에너지의 기준을 무한대에서 0으로 정했기 때문입니다.',speech:'운동 에너지는 이분의 일 엠 브이 제곱입니다. 중력 퍼텐셜 에너지는 마이너스 지 엠 엠 나누기 알입니다. 무한히 먼 곳의 퍼텐셜 에너지를 영으로 정합니다.',latex:'E = \\frac{1}{2}mv^2 - \\frac{GMm}{R}',seconds:24,page:1},
 {title:'에너지 보존',short:'최소 탈출 조건',heading:'간신히 탈출하는 조건,\n전체 에너지는 0입니다.',note:'최소 탈출 조건에서 거리가 무한대로 갈 때 속도는 0에 가까워집니다. 에너지가 보존되므로 출발 시 전체 에너지도 0입니다.',speech:'최소 탈출 조건에서는 무한히 멀어질 때 속도가 영에 가까워집니다. 역학적 에너지가 보존되므로 처음의 전체 에너지도 영입니다.',latex:'\\frac{1}{2}mv^2 - \\frac{GMm}{R} = 0',seconds:26,page:2},
 {title:'질량 약분',short:'물체의 질량은?',heading:'무거운 물체도\n같은 속도가 필요할까요?',note:'양변의 물체 질량 m을 약분합니다. 같은 출발 위치와 가정에서 탈출 속도는 물체의 질량과 무관합니다. 필요한 에너지는 질량에 비례합니다.',speech:'항을 옮기고 양변에서 물체의 질량 엠을 약분합니다. 따라서 같은 조건에서 물체의 질량은 탈출 속도에 영향을 주지 않습니다.',latex:'\\frac{1}{2}\\cancel{m}v^2 = \\frac{GM\\cancel{m}}{R}',seconds:24,page:2},
 {title:'공식 도출',short:'속도에 대해 정리',heading:'지구의 질량과 반지름이\n탈출 속도를 결정합니다.',note:'양변에 2를 곱하고 양의 제곱근을 취합니다. M은 지구의 질량, R은 지구 중심에서 출발점까지 거리입니다. 지표면에서는 지구 반지름입니다.',speech:'양변에 이를 곱하고 양의 제곱근을 취하면 탈출 속도는 루트 이 지 엠 나누기 알입니다. 대문자 엠은 지구의 질량입니다.',latex:'v_{\\mathrm{esc}} = \\sqrt{\\frac{2GM}{R}}',seconds:24,page:2},
 {title:'지구에 대입',short:'결과와 단위',heading:'지구 표면에서의 탈출 속도,\n초속 약 11.2킬로미터.',note:'계산값은 약 11,186 m/s, 즉 11.2 km/s입니다. 실제 로켓의 발사 속도나 일정한 비행 속도를 뜻하지 않는 이상화된 초기 조건입니다.',speech:'지구의 질량과 반지름을 대입하면 약 초속 십일 점 이 킬로미터입니다. 물체의 질량과 무관하지만 필요한 에너지는 물체 질량에 비례합니다.',latex:'v_{\\mathrm{esc}} \\approx 11{,}186\\;\\mathrm{m/s} \\approx 11.2\\;\\mathrm{km/s}',seconds:28,page:3},
] as const;
export const BUILTIN_PAGES=[
 {page:1,text:'지구 탈출 속도. 추가 추진 없이 무한히 멀어질 수 있는 최소 초기 속도. 지구를 구대칭으로 가정하고 공기저항, 지구 자전, 다른 천체의 영향을 무시한다. U(무한대)=0. 운동 에너지 K=1/2 mv^2. 중력 퍼텐셜 에너지 U=-GMm/r. 지표면의 r=R. 중력은 탈출 후에도 갑자기 사라지지 않는다.'},
 {page:2,text:'에너지 보존: 1/2 mv^2-GMm/R=0. 최소 탈출 조건 r→∞일 때 v→0. 정리하면 1/2 mv^2=GMm/R. 물체 질량 m을 약분하여 v^2=2GM/R. 양의 제곱근을 취하면 v_esc=sqrt(2GM/R). 같은 출발 위치에서 물체의 질량 m과 무관하지만 필요한 에너지는 m에 비례한다.'},
 {page:3,text:'G=6.67430×10^-11 m^3 kg^-1 s^-2. 지구 질량 M=5.9722×10^24 kg. 평균 반지름 R=6.371×10^6 m. 지표면 탈출 속도=11186 m/s≈11.2 km/s. 지구 중심에서 2R 거리의 탈출 속도는 약 7.91 km/s. 실제 로켓의 발사 속도나 계속 유지해야 할 속도를 뜻하지 않는다. 출처: NASA Earth Fact Sheet.'},
];
