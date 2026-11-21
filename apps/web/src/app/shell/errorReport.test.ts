import { describe, expect, it } from 'vitest';
import { formatErrorReport } from './errorReport';

const context = {
  appVersion: 'abc123',
  path: '/',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  time: new Date('2026-11-21T12:19:00Z'),
};

describe('formatErrorReport', () => {
  it('ghi tên, thông báo lỗi, vài dòng stack, component và môi trường', () => {
    const error = new TypeError("undefined is not an object (evaluating 'route.legs')");
    error.stack = [
      "TypeError: undefined is not an object (evaluating 'route.legs')",
      'RoutePanel@https://i-map/assets/index.js:1:200',
      ...Array.from({ length: 10 }, (_, index) => `frame${index}@https://i-map/assets/index.js:1:${index}`),
    ].join('\n');
    const report = formatErrorReport(error, '\n    at RoutePanel\n    at SheetPanel\n    at App', context);

    expect(report).toContain("TypeError: undefined is not an object (evaluating 'route.legs')");
    expect(report).toContain('RoutePanel@https://i-map/assets/index.js:1:200');
    expect(report).toContain('at RoutePanel');
    expect(report).toContain('Phiên bản: abc123');
    expect(report).toContain('iPhone OS 17_0');
    // Stack dài chỉ giữ vài dòng đầu để vừa một ảnh chụp màn hình.
    expect(report).not.toContain('frame9@');
  });

  it('lỗi không phải Error (ném chuỗi, object) vẫn ra nội dung đọc được', () => {
    expect(formatErrorReport('hỏng', null, context)).toMatch(/^string: hỏng/);
  });
});
