// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../shared/i18n/I18nProvider';
import { computeAreaInsight } from '../domain/areaInsight';
import { AreaInsightCard, AreaInsightPill } from './AreaInsightCard';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const noon = new Date(2026, 10, 25, 12, 0);
const renderVi = (node: React.ReactNode) => render(<I18nProvider>{node}</I18nProvider>);

describe('AreaInsightCard', () => {
  it('không còn hiển thị nhiệt độ hay "thời tiết minh họa"', () => {
    const { container } = renderVi(
      <AreaInsightCard insight={computeAreaInsight(0, noon)} onOpenTraffic={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(/°C|thời tiết/i);
    expect(screen.getByText('Ước tính: Giao thông thông thoáng')).toBeTruthy();
  });

  it('bản đồ thu nhỏ quá: yêu cầu phóng to thay vì báo "thông thoáng · chưa có sự cố"', () => {
    const { container } = renderVi(
      <AreaInsightCard insight={computeAreaInsight(0, noon, false)} onOpenTraffic={vi.fn()} />,
    );
    expect(screen.getByText('Phóng to bản đồ để ước tính giao thông khu vực')).toBeTruthy();
    expect(container.textContent).not.toMatch(/thông thoáng|Chưa có sự cố/);
  });

  it('mở bảng Giao thông khi bấm vào dòng ước tính', () => {
    const open = vi.fn();
    renderVi(<AreaInsightCard insight={computeAreaInsight(2, noon)} onOpenTraffic={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Mở bảng Giao thông/ }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('viên thuốc trên điện thoại cũng không có nhiệt độ, ghi rõ "Ước tính"', () => {
    const { container } = renderVi(
      <AreaInsightPill insight={computeAreaInsight(0, noon)} onOpenTraffic={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('°C');
    expect(container.textContent).toContain('Ước tính');
    cleanup();
    renderVi(<AreaInsightPill insight={computeAreaInsight(0, noon, false)} onOpenTraffic={vi.fn()} />);
    expect(screen.getByText('Phóng to để xem giao thông')).toBeTruthy();
  });
});
