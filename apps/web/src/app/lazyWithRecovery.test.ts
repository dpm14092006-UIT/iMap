import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWithRecovery } from './lazyWithRecovery';

declare const __APP_BUILD_VERSION__: string;

const reload = vi.fn();
const fetchVersion = vi.fn();
const storage = new Map<string, string>();
const importError = new TypeError('Failed to fetch dynamically imported module');
const failedImport = () => Promise.reject(importError);

beforeEach(() => {
  storage.clear();
  reload.mockReset();
  fetchVersion.mockReset();
  vi.stubGlobal('fetch', fetchVersion);
  vi.stubGlobal('window', {
    location: { reload },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

function versionResponse(version: string) {
  fetchVersion.mockResolvedValue({ ok: true, json: async () => ({ version }) });
}

describe('panels loaded from a tab that outlives a deployment', () => {
  it('loads normally without a version request', async () => {
    const panel = { default: () => null };
    expect(await loadWithRecovery(async () => panel)).toBe(panel);
    expect(fetchVersion).not.toHaveBeenCalled();
  });

  it('reloads once for a newer deployment and keeps the pending panel out of the error boundary', async () => {
    versionResponse('new-deployment');
    const settled = vi.fn();
    void loadWithRecovery(failedImport).then(settled, settled);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(settled).not.toHaveBeenCalled();
    expect(fetchVersion).toHaveBeenCalledWith(
      expect.stringContaining('/app-version.json?check='),
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    );
    await expect(loadWithRecovery(failedImport)).rejects.toBe(importError);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('preserves the original error for a broken chunk in the current deployment', async () => {
    versionResponse(__APP_BUILD_VERSION__);
    await expect(loadWithRecovery(failedImport)).rejects.toBe(importError);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when offline or when the version endpoint fails', async () => {
    fetchVersion.mockRejectedValueOnce(new TypeError('offline'));
    await expect(loadWithRecovery(failedImport)).rejects.toBe(importError);
    fetchVersion.mockResolvedValueOnce({ ok: false });
    await expect(loadWithRecovery(failedImport)).rejects.toBe(importError);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not risk a reload loop when session storage is blocked', async () => {
    versionResponse('new-deployment');
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    await expect(loadWithRecovery(failedImport)).rejects.toBe(importError);
    expect(reload).not.toHaveBeenCalled();
  });
});
