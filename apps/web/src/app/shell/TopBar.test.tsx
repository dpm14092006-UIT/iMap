// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../shared/i18n/I18nProvider';
import { LANGUAGE_STORAGE_KEY } from '../../shared/i18n/translate';
import { TopBar } from './TopBar';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const renderBar = (userEmail: string | null) =>
  render(
    <I18nProvider>
      <TopBar
        getFocus={() => ({ lat: 10.77, lng: 106.69 })}
        onSelectPlace={vi.fn()}
        strip={null}
        updateAvailable={false}
        onUpdate={vi.fn()}
        onInfo={vi.fn()}
        userEmail={userEmail}
        onSelectFeature={vi.fn()}
      />
    </I18nProvider>,
  );

describe('TopBar sign-in button', () => {
  it('chưa đăng nhập: ghi rõ "Đăng nhập" kèm biểu tượng, không còn chữ "ĐN" khó hiểu', () => {
    renderBar(null);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const link = screen.getByRole('link', { name: 'Đăng nhập tài khoản' });
    expect(link.textContent).toContain('Đăng nhập');
    expect(link.textContent).not.toContain('ĐN');
    expect(link.querySelector('svg')).toBeTruthy();
  });

  it('tiếng Anh: "Sign in" thay cho "SI"', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderBar(null);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link.textContent).toContain('Sign in');
    expect(link.textContent).not.toBe('SI');
  });

  it('đã đăng nhập: hiện chữ viết tắt email như trước', () => {
    renderBar('lan@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('link', { name: 'Tài khoản lan@example.com' }).textContent).toBe('LA');
  });
});
