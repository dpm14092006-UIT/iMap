import type { Language } from '../../../shared/i18n/translate';

type SpeechOutput = Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel'>;

/** Chỉ phát lời chỉ dẫn; không thu âm và không mở microphone. */
export class NavigationSpeaker {
  private current: SpeechSynthesisUtterance | null = null;
  private warning = false;

  constructor(
    private readonly output: SpeechOutput | null = typeof window !== 'undefined' &&
    'speechSynthesis' in window
      ? window.speechSynthesis
      : null,
    private readonly utterance:
      ((text: string) => SpeechSynthesisUtterance) | null = typeof SpeechSynthesisUtterance !== 'undefined'
      ? (text) => new SpeechSynthesisUtterance(text)
      : null,
  ) {}

  get supported(): boolean {
    return this.output !== null && this.utterance !== null;
  }

  speak(text: string, language: Language, priority = false): boolean {
    if (!this.output || !this.utterance || (this.warning && !priority)) return false;
    try {
      this.stop();
      const message = this.utterance(text);
      const locale = language === 'vi' ? 'vi-VN' : 'en-US';
      const voices = this.output.getVoices();
      message.lang = locale;
      message.voice =
        voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase()) ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith(language)) ??
        null;
      message.rate = 1;
      message.volume = 1;
      const release = () => {
        if (this.current === message) {
          this.current = null;
          this.warning = false;
        }
      };
      message.onend = release;
      message.onerror = release;
      this.current = message;
      this.warning = priority;
      this.output.speak(message);
      return true;
    } catch {
      this.current = null;
      this.warning = false;
      return false;
    }
  }

  stop(): void {
    this.current = null;
    this.warning = false;
    try {
      this.output?.cancel();
    } catch {
      // Chỉ dẫn trên màn hình vẫn dùng được khi thiết bị không phát được tiếng.
    }
  }
}
