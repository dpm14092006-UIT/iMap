import { describe, expect, it } from 'vitest';
import { ReportVersionGate } from './ReportVersionGate';

describe('ReportVersionGate', () => {
  it('mỗi phiên bản chỉ qua một lần; phiên bản mới hơn được qua lại', () => {
    const gate = new ReportVersionGate();
    expect(gate.admit('a')).toBe(true);
    expect(gate.admit('a')).toBe(false);
    expect(gate.admit('a', 1)).toBe(false);
    expect(gate.admit('a', 2)).toBe(true);
    expect(gate.admit('a', 1)).toBe(false); // phiên bản cũ về muộn
    expect(gate.admit('b', 1)).toBe(true);
  });

  it('vượt sức chứa thì quên báo cáo cũ nhất (giống Map 120 mục trong App.tsx cũ)', () => {
    const gate = new ReportVersionGate(3);
    for (const id of ['a', 'b', 'c', 'd']) expect(gate.admit(id)).toBe(true);
    expect(gate.admit('a')).toBe(true); // 'a' đã bị quên
    expect(gate.admit('c')).toBe(false);
    expect(gate.admit('d')).toBe(false);
  });

  it('mặc định nhớ 120 báo cáo', () => {
    const gate = new ReportVersionGate();
    for (let index = 0; index < 120; index++) gate.admit(`r${index}`);
    expect(gate.admit('r0')).toBe(false);
    gate.admit('r120');
    expect(gate.admit('r0')).toBe(true);
  });
});
