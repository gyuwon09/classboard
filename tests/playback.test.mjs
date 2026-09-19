import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPlayback, playbackReducer} from '../lib/playback.ts';
import {escapeSpeed, CONSTANTS} from '../lib/lesson.ts';

test('a lesson does not advance without a teacher action', () => {
  let state = {...initialPlayback};
  for (let second = 0; second < 300; second++) state = playbackReducer(state, {type: 'tick'});
  assert.equal(state.step, 0);
});
test('automatic progression waits for the entire interval, and pauses preserve reading time', () => {
  let state = playbackReducer(initialPlayback, {type: 'toggle'});
  for (let second = 0; second < 29; second++) state = playbackReducer(state, {type:'tick'});
  assert.equal(state.step, 0);
  assert.equal(state.remaining, 1);
  state = playbackReducer(state, {type:'pause'});
  for (let second = 0; second < 60; second++) state = playbackReducer(state, {type:'tick'});
  assert.equal(state.step, 0);
  state = playbackReducer(state, {type:'toggle'});
  state = playbackReducer(state, {type:'tick'});
  assert.equal(state.step, 1);
  assert.equal(state.remaining, 30);
});
test('manual navigation stops automatic advancement and resets the reading interval', () => {
  const running = {...initialPlayback, playing:true, remaining:1};
  const state = playbackReducer(running, {type:'seek', step:3});
  assert.deepEqual(state, {...initialPlayback, step:3});
  assert.equal(playbackReducer(state, {type:'seek', step:NaN}), state);
  assert.equal(playbackReducer(state, {type:'seek', step:6}), state);
});
test('pace cannot be too fast and final step stays visible', () => {
  assert.equal(playbackReducer(initialPlayback, {type:'duration',seconds:5}), initialPlayback);
  assert.equal(playbackReducer(initialPlayback, {type:'duration',seconds:20}).duration,20);
  const last = playbackReducer({...initialPlayback,step:4,playing:true,remaining:1}, {type:'tick'});
  assert.equal(last.step,5);
  assert.equal(last.playing,false);
  assert.equal(playbackReducer(last,{type:'toggle'}),last);
});
test('Earth result uses SI units and rejects invalid inputs', () => {
  assert.ok(Math.abs(escapeSpeed(CONSTANTS.M,CONSTANTS.R)-11186.1652)<0.01);
  assert.ok(Math.abs(escapeSpeed(CONSTANTS.M,2*CONSTANTS.R)/escapeSpeed(CONSTANTS.M,CONSTANTS.R)-1/Math.sqrt(2))<1e-12);
  for(const input of [0,-1,NaN,Infinity]) assert.throws(()=>escapeSpeed(CONSTANTS.M,input));
});
