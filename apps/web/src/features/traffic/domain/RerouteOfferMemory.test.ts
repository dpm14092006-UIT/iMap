import { describe, expect, it } from 'vitest';
import { RerouteOfferMemory } from './RerouteOfferMemory';

/** Dịch điểm về phía bắc `meters` mét (1° vĩ độ ≈ 111,32 km). */
const north = (meters: number) => ({ lat: 10.77 + meters / 111_320, lng: 106.7 });

describe('RerouteOfferMemory', () => {
  it('sự cố đã hỏi và báo cáo khác trong cùng cụm 80 m không hỏi lại', () => {
    const memory = new RerouteOfferMemory(80);
    memory.remember({ id: 'a', ...north(0) });
    expect(memory.has({ id: 'a', ...north(0) })).toBe(true);
    expect(memory.has({ id: 'b', ...north(60) })).toBe(true);
    expect(memory.has({ id: 'c', ...north(200) })).toBe(false);
  });

  it('kịch bản review #1: sự cố cạnh tuyến không được nhớ nên không chặn sự cố trên tuyến gần nó', () => {
    const memory = new RerouteOfferMemory(80);
    const offRoute = { id: 'beside', ...north(150) };
    const onRoute = { id: 'on-route', ...north(90) }; // cách sự cố cạnh tuyến 60 m

    // Hook chỉ gọi remember() khi sự cố nằm trên tuyến → sự cố cạnh tuyến bị bỏ qua.
    expect(memory.has(offRoute)).toBe(false);
    expect(memory.has(onRoute)).toBe(false);
    memory.remember(onRoute);
    expect(memory.has(onRoute)).toBe(true);
  });

  it('clear() quên hết khi kết thúc chuyến', () => {
    const memory = new RerouteOfferMemory(80);
    memory.remember({ id: 'a', ...north(0) });
    memory.clear();
    expect(memory.has({ id: 'a', ...north(0) })).toBe(false);
  });
});
