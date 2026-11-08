import { useEffect, useRef, useState } from 'react';
import { SpeechDraftSession, speechFactory } from '../services/SpeechDraftSession';
export function useSpeechDraft(onDraft: (text: string) => void) {
  const [supported] = useState(() => Boolean(speechFactory()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const latestDraft = useRef(onDraft); latestDraft.current = onDraft;
  const session = useRef<SpeechDraftSession | null>(null);
  useEffect(() => {
    const factory = speechFactory();
    if (factory) session.current = new SpeechDraftSession(factory, (text) => latestDraft.current(text), setListening, setError);
    return () => { session.current?.stop(); session.current = null; };
  }, []);
  return {
    supported, listening, error,
    start: (language: string) => { setError(''); session.current?.start(language); },
    stop: () => session.current?.stop(),
  };
}
