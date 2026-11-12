import { useCallback, useEffect, useRef, useState } from 'react';
import { assistantApi } from '../services/assistantApi';
import { recordingToWav } from '../services/voiceAudio';
export function useApiSpeechDraft(onDraft: (text: string) => void, accessToken: string) {
  const [available, setAvailable] = useState(false),
    [listening, setListening] = useState(false),
    [processing, setProcessing] = useState(false),
    [error, setError] = useState('');
  const currentDraft = useRef(onDraft);
  currentDraft.current = onDraft;
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0),
    request = useRef<AbortController | null>(null),
    busy = useRef(false);
  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);
  const cancel = useCallback(() => {
    generation.current++;
    request.current?.abort();
    request.current = null;
    const active = recorder.current;
    recorder.current = null;
    if (active) {
      active.onstop = null;
      active.ondataavailable = null;
      if (active.state !== 'inactive') active.stop();
    }
    release();
    busy.current = false;
    setListening(false);
    setProcessing(false);
  }, [release]);
  useEffect(() => {
    setAvailable(false);
    const controller = new AbortController();
    if (typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      void assistantApi
        .voiceConfig(controller.signal, accessToken)
        .then((config) => {
          if (!controller.signal.aborted) setAvailable(config.available);
        })
        .catch(() => {});
    }
    return () => {
      controller.abort();
      cancel();
    };
  }, [accessToken, cancel]);
  const start = async () => {
    if (!available || busy.current) return;
    busy.current = true;
    const version = ++generation.current;
    setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (version !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const active = new MediaRecorder(media, mimeType ? { mimeType } : undefined),
        chunks: Blob[] = [];
      recorder.current = active;
      active.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      active.onerror = () => {
        cancel();
        setError('Không ghi được âm thanh. Hãy thử lại hoặc nhập chữ.');
      };
      active.onstop = () => {
        recorder.current = null;
        release();
        setListening(false);
        setProcessing(true);
        void (async () => {
          try {
            const audio = await recordingToWav(new Blob(chunks, { type: active.mimeType }));
            if (version !== generation.current) return;
            const controller = new AbortController();
            request.current = controller;
            const result = await assistantApi.transcribe(audio, controller.signal, accessToken);
            if (version === generation.current) currentDraft.current(result.text);
          } catch (cause) {
            if (version === generation.current)
              setError(cause instanceof Error ? cause.message : 'Voice chưa sẵn sàng.');
          } finally {
            if (version === generation.current) {
              busy.current = false;
              setProcessing(false);
            }
          }
        })();
      };
      active.start();
      setListening(true);
      timer.current = setTimeout(() => {
        if (active.state === 'recording') active.stop();
      }, 15000);
    } catch {
      if (version === generation.current) {
        release();
        busy.current = false;
        setError('Chưa được cấp quyền micro hoặc không có thiết bị. Kiểm tra quyền micro và dùng HTTPS.');
      }
    }
  };
  return {
    available,
    listening,
    processing,
    error,
    start,
    stop: () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    cancel,
  };
}
