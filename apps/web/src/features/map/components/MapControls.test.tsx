// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../shared/i18n/I18nProvider';
import { MapControls } from './MapControls';

afterEach(cleanup);

const setup = (view3d: boolean, bearing = 0) => {
  const onToggle3d = vi.fn();
  const onResetNorth = vi.fn();
  render(
    <I18nProvider>
      <MapControls
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onLocate={vi.fn()}
        view3d={view3d}
        onToggle3d={onToggle3d}
        camera={{ bearing, pitch: view3d ? 50 : 0 }}
        onResetNorth={onResetNorth}
      />
    </I18nProvider>,
  );
  return { onToggle3d, onResetNorth };
};

describe('MapControls: một nút cho 3D và la bàn', () => {
  it('2D chưa xoay: chỉ có nút hình khối, bấm thì bật 3D', () => {
    const { onToggle3d } = setup(false);
    expect(screen.queryByRole('button', { name: /hướng Bắc/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang bản đồ 3D' }));
    expect(onToggle3d).toHaveBeenCalledOnce();
  });

  it('đang 3D: nút thành la bàn, bấm thì về hướng Bắc và 2D', () => {
    const { onToggle3d, onResetNorth } = setup(true, 30);
    expect(screen.queryByRole('button', { name: 'Chuyển sang bản đồ 3D' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Về hướng Bắc, chuyển sang bản đồ 2D' }));
    expect(onToggle3d).toHaveBeenCalledOnce();
    expect(onResetNorth).not.toHaveBeenCalled();
  });

  it('2D nhưng bản đồ bị xoay: la bàn chỉ xoay về hướng Bắc', () => {
    const { onToggle3d, onResetNorth } = setup(false, 45);
    fireEvent.click(screen.getByRole('button', { name: 'Xoay về hướng Bắc' }));
    expect(onResetNorth).toHaveBeenCalledOnce();
    expect(onToggle3d).not.toHaveBeenCalled();
  });
});
