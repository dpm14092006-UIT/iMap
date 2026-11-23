// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

declare const __APP_BUILD_VERSION__: string;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

function Broken(): never {
  throw new TypeError("undefined is not an object (evaluating 'route.legs')");
}

function BrokenDirections(): never {
  throw new TypeError('Directions panel failed to render');
}

describe('ErrorBoundary', () => {
  it('hiện chi tiết lỗi để người dùng chụp hoặc sao chép gửi lại', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Đã có lỗi xảy ra')).toBeTruthy();
    expect(screen.getByText('Chi tiết lỗi')).toBeTruthy();
    expect(screen.getByText(/TypeError: undefined is not an object/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép chi tiết lỗi' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('TypeError'));
    expect(await screen.findByRole('button', { name: 'Đã sao chép' })).toBeTruthy();
  });

  it('vẫn hiện nút tải lại khi không đọc được chi tiết lỗi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function BrokenWithoutMessage(): never {
      throw Object.create(null);
    }

    render(
      <ErrorBoundary>
        <BrokenWithoutMessage />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeTruthy();
  });

  it('shows the actual failure, build, browser and component without including the URL query', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.replaceState(null, '', '/?token=private-route-token');
    render(
      <ErrorBoundary>
        <BrokenDirections />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading').textContent).toBe('Đã có lỗi xảy ra');
    const summary = screen.getByText('Chi tiết lỗi');
    expect(summary.closest('details')?.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest('details')?.open).toBe(true);
    const diagnostics = screen.getByText(/TypeError: Directions panel failed to render/).textContent;
    expect(diagnostics).toContain(`Phiên bản: ${__APP_BUILD_VERSION__}`);
    expect(diagnostics).toContain(navigator.userAgent);
    expect(diagnostics).toContain('BrokenDirections');
    expect(diagnostics).not.toContain('private-route-token');
  });

  it('keeps healthy children mounted without showing diagnostics', () => {
    render(
      <ErrorBoundary>
        <div>Map ready</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Map ready')).toBeTruthy();
    expect(screen.queryByText('Chi tiết lỗi')).toBeNull();
  });

  it('offers translated diagnostics when English is selected', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('imap-language', 'en');
    render(
      <ErrorBoundary>
        <BrokenDirections />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Error details')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
  });
});
