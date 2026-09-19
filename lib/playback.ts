export type Playback = { step: number; playing: boolean; remaining: number; duration: number };
export type PlaybackAction = { type: 'seek'; step: number } | { type: 'toggle' } | { type: 'pause' } | { type: 'tick' } | { type: 'duration'; seconds: number };
export const initialPlayback: Playback = { step: 0, playing: false, remaining: 30, duration: 30 };
export function playbackReducer(state: Playback, action: PlaybackAction): Playback {
  switch (action.type) {
    case 'seek':
      if (!Number.isInteger(action.step) || action.step < 0 || action.step > 5) return state;
      return { ...state, step: action.step, playing: false, remaining: state.duration };
    case 'pause': return { ...state, playing: false };
    case 'toggle': return state.step === 5 ? state : { ...state, playing: !state.playing };
    case 'duration':
      if (!Number.isInteger(action.seconds) || action.seconds < 20 || action.seconds > 60) return state;
      return { ...state, duration: action.seconds, remaining: action.seconds, playing: false };
    case 'tick':
      if (!state.playing) return state;
      if (state.remaining > 1) return { ...state, remaining: state.remaining - 1 };
      return { ...state, step: Math.min(5, state.step + 1), playing: state.step < 4, remaining: state.duration };
  }
}
