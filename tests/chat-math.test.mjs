import test from 'node:test';
import assert from 'node:assert/strict';
import {splitChatMath,renderChatMath} from '../lib/chat-math.ts';
test('mixed Korean prose, inline and display formulas preserve their order',()=>{
  const text=String.raw`속력은 \(v\)이고, $$K=\frac{1}{2}mv^2$$ 입니다. \[\vec{F}=m\vec{a}\] $v_{0x}$`;
  const parts=splitChatMath(text);
  assert.equal(parts.map(part=>part.text).join(''),text);
  assert.deepEqual(parts.filter(part=>part.latex!==undefined).map(part=>part.display),[false,true,true,false]);
  for(const part of parts.filter(part=>part.latex!==undefined))assert.match(renderChatMath(part.latex,part.display),/class="katex/);
});
test('fractions, powers, subscripts and vector notation produce accessible math',()=>{
  const html=renderChatMath(String.raw`\frac{1}{2}m v_0^2 + \vec{F}`,true);
  assert.match(html,/<mfrac>/);assert.match(html,/<msubsup>/);assert.match(html,/<mover/);assert.match(html,/<math/);
});
test('unmatched math, escaped dollars and regular text stay unchanged',()=>{
  for(const text of [String.raw`가격은 \$20입니다.`,String.raw`수식 \(x+1`, '일반 설명입니다.', '$20 and $30'])assert.ok(splitChatMath(text).every(part=>part.latex===undefined));
});
test('invalid formulas fall back and math commands cannot emit trusted HTML links',()=>{
  assert.equal(renderChatMath(String.raw`\frac{1}{`,true),null);
  const html=renderChatMath(String.raw`\href{javascript:alert(1)}{x}`,false);
  assert.ok(!html || !html.includes('href="javascript:'));
  assert.equal(splitChatMath('<script>alert(1)</script>')[0].latex,undefined);
});
