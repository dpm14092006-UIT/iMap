import { describe, expect, it, vi } from 'vitest';
import { NavigationSpeaker } from './NavigationSpeaker';

function setup() {
  const voices = [
    { lang: 'vi-VN', name: 'Vietnamese' },
    { lang: 'en-US', name: 'English' },
  ] as SpeechSynthesisVoice[];
  const output = {
    getVoices: () => voices,
    speak: vi.fn<(message: SpeechSynthesisUtterance) => void>(),
    cancel: vi.fn(),
  };
  const create = (text: string) => ({ text }) as SpeechSynthesisUtterance;
  return { output, voices, speaker: new NavigationSpeaker(output, create) };
}

describe('navigation audio output', () => {
  it('chooses the UI language and replaces stale instructions instead of queueing them', () => {
    const { speaker, output, voices } = setup();
    speaker.speak('Rẽ phải', 'vi');
    speaker.speak('Turn left', 'en');
    expect(output.cancel).toHaveBeenCalledTimes(2);
    expect(output.speak.mock.calls[0]?.[0]).toMatchObject({ lang: 'vi-VN', voice: voices[0] });
    expect(output.speak.mock.calls[1]?.[0]).toMatchObject({ lang: 'en-US', voice: voices[1] });
  });
  it('does not let a routine instruction interrupt a warning', () => {
    const { speaker, output } = setup();
    expect(speaker.speak('Warning', 'en', true)).toBe(true);
    expect(speaker.speak('Turn right', 'en')).toBe(false);
    const warning = output.speak.mock.calls[0]![0];
    warning.onend?.call(warning, {} as SpeechSynthesisEvent);
    expect(speaker.speak('Turn right', 'en')).toBe(true);
  });
  it('cancels immediately when muted or navigation ends', () => {
    const { speaker, output } = setup();
    speaker.speak('Turn right', 'en');
    output.cancel.mockClear();
    speaker.stop();
    expect(output.cancel).toHaveBeenCalledOnce();
  });
  it('handles unavailable output and synthesis failures without breaking navigation', () => {
    expect(new NavigationSpeaker(null, null).supported).toBe(false);
    expect(new NavigationSpeaker(null, null).speak('Turn', 'en')).toBe(false);
    const { speaker, output } = setup();
    output.speak.mockImplementation(() => {
      throw new Error('not available');
    });
    expect(speaker.speak('Turn', 'en')).toBe(false);
  });
});
