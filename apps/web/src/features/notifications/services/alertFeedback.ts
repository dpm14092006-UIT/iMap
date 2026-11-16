/** Kêu + rung để cảnh báo trên tuyến không bị "im im". Trình duyệt chặn âm thanh thì bỏ qua êm. */
let audioContext: AudioContext | null = null;

export function playAlertFeedback(): void {
  try {
    navigator.vibrate?.([300, 120, 300, 120, 300]);
  } catch {
    // Một số trình duyệt không cho rung.
  }
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    const context = audioContext;
    void context.resume?.();
    const start = context.currentTime + 0.02;
    [0, 0.28, 0.56].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = index === 2 ? 1046 : 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.24);
    });
  } catch {
    // Không phát được âm thanh (chưa có tương tác người dùng) — banner + rung vẫn hiện.
  }
}

/** Tab đang chạy nền mà chưa có Web Push từ server: tự hiện thông báo hệ thống qua service worker. */
export async function showLocalSystemNotification(title: string, body: string, tag: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
    const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
      body,
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 120, 300],
      icon: '/apple-touch-icon.png',
    };
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Bỏ qua: banner trong app vẫn còn khi người dùng quay lại.
  }
}
