// @vitest-environment jsdom
import type { TrafficImageAnalysisDto } from '@routetwin/shared';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../../testing/fixtures';
import { trafficApi, trafficPhotos } from '../api/trafficApi';
import type { TrafficReportPanelProps } from '../types';
import { useTrafficReportForm } from './useTrafficReportForm';
vi.mock('../api/trafficApi', () => ({
  trafficApi: { imageAnalysisReady: vi.fn(), analyzeImage: vi.fn() },
  trafficPhotos: { signedUrl: vi.fn() },
}));
vi.mock('../../../shared/i18n/I18nProvider', () => ({
  useI18n: () => ({ language: 'vi', t: (s: string) => s }),
}));
beforeEach(() => {
  vi.mocked(trafficApi.imageAnalysisReady)
    .mockReset()
    .mockResolvedValue({ configured: { trafficImageAi: true } });
  vi.mocked(trafficApi.analyzeImage).mockReset();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(overrides: Partial<TrafficReportPanelProps> = {}) {
  const props: TrafficReportPanelProps = {
    incidents: [],
    selectedPoint: { lat: 10, lng: 106 },
    isAuthenticated: true,
    accessToken: 'first',
    defaultVehicle: 'car',
    loading: false,
    error: '',
    onClose: vi.fn(),
    onSignIn: vi.fn(),
    onReport: vi.fn().mockResolvedValue(undefined),
    onClearance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return {
    ...renderHook((p: TrafficReportPanelProps) => useTrafficReportForm(p), { initialProps: props }),
    props,
  };
}
const photo = () => new File(['pixels'], 'scene.png', { type: 'image/png' });
const analysis: TrafficImageAnalysisDto = {
  task: 'incident',
  trafficRelated: true,
  incidentType: 'flood',
  confidence: 'high',
  summary: 'Flooded road',
  evidence: ['Water'],
  canDetermineSpeed: false,
};
describe('traffic photo/report form', () => {
  it('rejects unsupported photos before any request', () => {
    const { result } = setup();
    act(() => result.current.selectPhoto(new File(['x'], 'x.svg', { type: 'image/svg+xml' })));
    expect(result.current.photo).toBeNull();
    expect(result.current.actionError).toContain('JPG');
    expect(trafficApi.analyzeImage).not.toHaveBeenCalled();
  });
  it('rejects photos larger than 5 MiB', () => {
    const { result } = setup();
    const file = photo();
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    act(() => result.current.selectPhoto(file));
    expect(result.current.photo).toBeNull();
    expect(result.current.actionError).toContain('5 MB');
  });
  it('revokes its object URL when removed or unmounted', () => {
    const { result, unmount } = setup();
    act(() => result.current.selectPhoto(photo()));
    expect(result.current.photoPreview).toBe('blob:preview');
    act(() => result.current.setPhoto(null));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    act(() => result.current.selectPhoto(photo()));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
  it('requires sign-in before analysing a photo', async () => {
    const { result, props } = setup({ accessToken: null });
    act(() => result.current.selectPhoto(photo()));
    await act(() => result.current.analyzePhoto('incident'));
    expect(props.onSignIn).toHaveBeenCalledOnce();
    expect(trafficApi.analyzeImage).not.toHaveBeenCalled();
  });
  it('applies the suggested type/note while retaining manual severity', async () => {
    vi.mocked(trafficApi.analyzeImage).mockResolvedValue(analysis);
    const { result } = setup();
    act(() => result.current.selectPhoto(photo()));
    await act(() => result.current.analyzePhoto('incident'));
    act(() => result.current.applyIncidentSuggestion());
    expect(result.current.type).toBe('flood');
    expect(result.current.note).toBe('Flooded road');
    expect(result.current.severity).toBe('medium');
  });
  it.each(['token', 'photo', 'unmount'] as const)(
    'ignores stale photo analysis after %s changes',
    async (change) => {
      const task = deferred<TrafficImageAnalysisDto>();
      vi.mocked(trafficApi.analyzeImage).mockReturnValue(task.promise);
      const view = setup();
      act(() => view.result.current.selectPhoto(photo()));
      act(() => {
        void view.result.current.analyzePhoto('incident');
      });
      const signal = vi.mocked(trafficApi.analyzeImage).mock.calls[0]![3]!;
      if (change === 'token') view.rerender({ ...view.props, accessToken: 'second' });
      if (change === 'photo') act(() => view.result.current.selectPhoto(photo()));
      if (change === 'unmount') view.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => task.resolve(analysis));
      expect(view.result.current.imageAnalysis).toBeNull();
    },
  );
  it('does not send without coordinates', async () => {
    const { result, props } = setup({ selectedPoint: null });
    await act(() => result.current.submit());
    expect(props.onReport).not.toHaveBeenCalled();
  });
  it('sends a trimmed note and resets attachments on success', async () => {
    const { result, props } = setup();
    act(() => {
      result.current.setNote('  Road closed  ');
      result.current.selectPhoto(photo());
    });
    await act(() => result.current.submit());
    expect(props.onReport).toHaveBeenCalledWith(
      'traffic_jam',
      'medium',
      'car',
      { lat: 10, lng: 106 },
      'Road closed',
      expect.any(File),
    );
    expect(result.current.note).toBe('');
    expect(result.current.photo).toBeNull();
    expect(result.current.busy).toBe(false);
  });
  it('keeps the draft after a failed report', async () => {
    const { result } = setup({ onReport: vi.fn().mockRejectedValue(new Error('offline')) });
    act(() => result.current.setNote('Keep me'));
    await act(() => result.current.submit());
    expect(result.current.note).toBe('Keep me');
    expect(result.current.actionError).toBe('offline');
    expect(result.current.busy).toBe(false);
  });
});

describe('link ảnh báo cáo (issue #19, mục 18)', () => {
  afterEach(() => vi.useRealTimers());

  it('bảng mở quá hạn link: tự ký lại, cập nhật danh sách bình thường thì không ký lại', async () => {
    vi.useFakeTimers();
    let signed = 0;
    vi.mocked(trafficPhotos.signedUrl)
      .mockReset()
      .mockImplementation(async (path) => `https://signed/${path}?v=${++signed}`);
    const incidents = () =>
      [{ id: 'r1', imagePath: 'reports/expiry-test.jpg' }] as TrafficReportPanelProps['incidents'];
    const view = setup({ incidents: incidents() });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(view.result.current.photoUrls.r1).toBe('https://signed/reports/expiry-test.jpg?v=1');

    // Realtime gửi lại cùng danh sách (mảng mới, cùng id và đường dẫn): dùng lại link trong cache.
    await act(async () => {
      view.rerender({ ...view.props, incidents: incidents() });
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(trafficPhotos.signedUrl).toHaveBeenCalledOnce();

    // Giữ bảng mở 11 phút (link Supabase chỉ có hạn 10 phút), danh sách không đổi.
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(trafficPhotos.signedUrl).toHaveBeenCalledTimes(2);
    expect(view.result.current.photoUrls.r1).toBe('https://signed/reports/expiry-test.jpg?v=2');
  });
});
