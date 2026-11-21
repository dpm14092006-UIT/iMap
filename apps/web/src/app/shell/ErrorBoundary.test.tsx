// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new TypeError("undefined is not an object (evaluating 'route.legs')");
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
});
