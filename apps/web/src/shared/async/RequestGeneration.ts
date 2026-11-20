/** Một yêu cầu đã bắt đầu; hỏi `isCurrent()` sau `await` để biết kết quả còn được dùng không. */
export type GenerationTicket = { isCurrent: () => boolean };

/**
 * Bộ đếm "thế hệ" cho một luồng bất đồng bộ: mỗi yêu cầu mới (hoặc `invalidate`) làm mọi yêu cầu
 * trước đó hết hiệu lực, để kết quả về chậm không ghi đè trạng thái mới hơn.
 * Khác `RequestSequence` (theo từng kênh), lớp này dùng cho một luồng duy nhất.
 */
export class RequestGeneration {
  private current = 0;

  begin(): GenerationTicket {
    const id = ++this.current;
    return { isCurrent: () => id === this.current };
  }

  invalidate(): void {
    this.current++;
  }
}
