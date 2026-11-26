import { describe, expect, it } from 'vitest';
import { fitPopupHeight, MIN_POPUP_PX } from './popupFit';

describe('fitPopupHeight', () => {
  it('màn hình thấp (630 px): danh sách dừng trên nút ở chân panel thay vì tràn xuống dưới', () => {
    // Ô nhập ở 293 px, thân panel (vùng cuộn) kết thúc ở 545 px, nút "Tìm đường" ở 562 px.
    const { maxHeight, needsScroll } = fitPopupHeight({
      popupTop: 293,
      containerBottom: 545,
      viewportHeight: 630,
    });
    expect(293 + maxHeight).toBeLessThanOrEqual(545);
    expect(needsScroll).toBe(false);
  });

  it('màn hình cao: giới hạn 560 px hoặc 60% chiều cao', () => {
    expect(fitPopupHeight({ popupTop: 100, containerBottom: 2000, viewportHeight: 2000 }).maxHeight).toBe(
      560,
    );
    expect(fitPopupHeight({ popupTop: 100, containerBottom: 800, viewportHeight: 800 }).maxHeight).toBe(480);
  });

  it('quá chật thì giữ chiều cao tối thiểu và yêu cầu cuộn panel', () => {
    expect(fitPopupHeight({ popupTop: 500, containerBottom: 545, viewportHeight: 630 })).toEqual({
      maxHeight: MIN_POPUP_PX,
      needsScroll: true,
    });
  });

  it('vùng cuộn dài hơn khung nhìn thì lấy mép dưới khung nhìn', () => {
    const { maxHeight } = fitPopupHeight({ popupTop: 100, containerBottom: 5000, viewportHeight: 600 });
    expect(100 + maxHeight).toBeLessThanOrEqual(600);
  });
});
