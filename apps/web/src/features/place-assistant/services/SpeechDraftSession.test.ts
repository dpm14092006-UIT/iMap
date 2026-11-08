import { describe, expect, it, vi } from 'vitest';
import { SpeechDraftSession, type SpeechEngine } from './SpeechDraftSession';
function setup() {
  const engines: MockEngine[] = [];
  class MockEngine implements SpeechEngine {
    lang = ''; continuous = true; interimResults = true;
    onresult: SpeechEngine['onresult'] = null; onerror: SpeechEngine['onerror'] = null; onend: SpeechEngine['onend'] = null;
    start = vi.fn(); abort = vi.fn();
    constructor() { engines.push(this); }
  }
  const draft = vi.fn(); const state = vi.fn(); const error = vi.fn();
  return { session: new SpeechDraftSession(MockEngine, draft, state, error), engines, draft, state, error };
}
describe('voice writes a draft and never automatically searches', () => {
  it('does not construct or start recognition without a user action', () => {
    const { engines } = setup(); expect(engines).toHaveLength(0);
  });
  it('sets language, accepts final transcript and ignores interim text', () => {
    const { session, engines, draft } = setup(); session.start('en-US');
    const engine = engines[0]!;
    expect(engine.lang).toBe('en-US'); expect(engine.continuous).toBe(false); expect(engine.start).toHaveBeenCalledTimes(1);
    engine.onresult!({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'find' } }] }); expect(draft).not.toHaveBeenCalled();
    engine.onresult!({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Find a gas station' } }] }); expect(draft).toHaveBeenCalledExactlyOnceWith('Find a gas station');
  });
  it('ignores a late callback after cancel/unmount', () => {
    const { session, engines, draft } = setup(); session.start('vi-VN');
    const engine = engines[0]!; const late = engine.onresult!; session.stop();
    late({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Tìm trạm xăng' } }] });
    expect(draft).not.toHaveBeenCalled(); expect(engine.abort).toHaveBeenCalledTimes(1);
  });
  it('keeps text input usable after permission denial and stops listening', () => {
    const { session, engines, state, error } = setup(); session.start('en-US');
    engines[0]!.onerror!({ error: 'not-allowed' }); expect(state).toHaveBeenLastCalledWith(false); expect(error).toHaveBeenCalledWith(expect.stringContaining('chưa được cấp quyền'));
  });
  it('does not open duplicate microphone sessions', () => {
    const { session, engines } = setup(); session.start('en-US'); session.start('en-US'); expect(engines).toHaveLength(1);
  });
});
