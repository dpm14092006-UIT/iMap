export type SpeechEngine = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
};
export type SpeechFactory = new () => SpeechEngine;
export function speechFactory(): SpeechFactory | null {
  if (typeof window === 'undefined') return null;
  const browser = window as unknown as { SpeechRecognition?: SpeechFactory; webkitSpeechRecognition?: SpeechFactory };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}
/** Speech only edits a draft. Searching and route changes require separate user actions. */
export class SpeechDraftSession {
  private engine: SpeechEngine | null = null;
  constructor(private readonly factory: SpeechFactory, private readonly onDraft: (text: string) => void, private readonly onState: (listening: boolean) => void, private readonly onError: (message: string) => void) {}
  start(language: string) {
    if (this.engine) return;
    const engine = new this.factory(); this.engine = engine;
    engine.lang = language; engine.continuous = false; engine.interimResults = false;
    engine.onresult = (event) => {
      if (this.engine !== engine) return;
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) parts.push(result[0].transcript);
      }
      const draft = parts.join(' ').trim();
      if (draft) this.onDraft(draft.slice(0, 300));
    };
    engine.onerror = (event) => {
      if (this.engine !== engine) return;
      this.onError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone chưa được cấp quyền. Bạn vẫn có thể nhập chữ.'
        : event.error === 'no-speech' ? 'Chưa nghe rõ câu nói. Hãy thử lại hoặc nhập chữ.' : 'Không nhận được giọng nói. Hãy thử lại hoặc nhập chữ.');
      this.stop();
    };
    engine.onend = () => { if (this.engine === engine) { this.engine = null; this.onState(false); } };
    try { this.onState(true); engine.start(); }
    catch { this.stop(); this.onError('Trình duyệt chưa khởi động được nhận giọng nói. Bạn có thể nhập chữ.'); }
  }
  stop() {
    const engine = this.engine; this.engine = null;
    if (engine) {
      engine.onresult = null; engine.onerror = null; engine.onend = null;
      try { engine.abort(); } catch { /* Engine may already be stopped. */ }
    }
    this.onState(false);
  }
}
