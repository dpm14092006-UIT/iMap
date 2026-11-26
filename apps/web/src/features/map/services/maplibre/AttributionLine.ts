import type { IControl } from 'maplibre-gl';
import type { GLMap } from './gl';

/**
 * Khung ghi nguồn bắt buộc (góc dưới phải): ghi đúng chuỗi trong registry của nguồn nền đang hiển thị và
 * nguồn của bản đồ phụ. Chuỗi chỉ đến từ registry trong mã nguồn (không từ người dùng hay máy chủ).
 */
export class AttributionLine implements IControl {
  private element: HTMLElement | null = null;
  private readonly parts = new Map<string, string>();

  onAdd(_map: GLMap): HTMLElement {
    const element = document.createElement('div');
    element.className = 'maplibregl-ctrl maplibregl-ctrl-attrib routetwin-attribution';
    // Điện thoại: một dòng cắt "…"; chạm để xem đủ (ghi nguồn vẫn luôn hiện, không ẩn hẳn).
    element.addEventListener('click', (event) => {
      if (event.target instanceof HTMLAnchorElement) return;
      element.classList.toggle('is-expanded');
    });
    this.element = element;
    this.render();
    return element;
  }

  onRemove() {
    this.element?.remove();
    this.element = null;
  }

  set(key: string, html: string | null) {
    if (html) this.parts.set(key, html);
    else this.parts.delete(key);
    this.render();
  }

  private render() {
    if (!this.element) return;
    const unique = [...new Set(this.parts.values())];
    this.element.innerHTML = `<div class="maplibregl-ctrl-attrib-inner">${unique.join(' | ')}</div>`;
    this.element.title = this.element.textContent ?? '';
    this.element.hidden = unique.length === 0;
  }
}
