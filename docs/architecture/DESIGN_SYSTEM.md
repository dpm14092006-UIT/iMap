# Design system

## Token và theme

`shared/styles/tokens.css` định nghĩa màu theo vai trò, dưới dạng ba kênh RGB. Tailwind ánh xạ các token để dùng được opacity như `bg-surface/90`. `.dark` thay giá trị token trên cùng cây giao diện, không dò chuỗi class để ghi đè utility.

| Token | Dùng cho |
| --- | --- |
| `surface`, `surface-muted`, `surface-raised` | Panel, nền phụ, control/chip |
| `content`, `content-muted`, `content-subtle` | Nội dung chính, phụ, trợ giúp |
| `line` | Viền và đường phân cách |
| `primary`, `primary-hover`, `on-primary` | Hành động chính và chữ trên nút |
| `focus` | Viền/ring bàn phím |
| `danger` | Hành động xoá, lỗi |

Brand indigo/teal và màu dữ liệu giao thông giữ vai trò riêng; không đổi màu mức độ sự cố theo theme. Tất cả trạng thái cần có chữ/icon ngoài màu.

## Component dùng chung

- `Button`: native button, mặc định `type="button"`; form phải khai báo `type="submit"`. Variant `primary`, `secondary`, `ghost`, `danger`. `loading` vô hiệu hoá thao tác và bật `aria-busy`.
- `Input`, `Select`, `Textarea`: giữ nguyên native props, validation, ref và ARIA. Nơi dùng cung cấp label/aria-label. Checkbox, radio và file input tiếp tục dùng native control phù hợp.
- `SheetPanel`: bố cục panel desktop/bottom sheet mobile, footer và vùng cuộn, Escape và snap theo bàn phím.
- `Popover`, `Icon`: dùng chung thay vì nhân bản theo feature.

Class bố cục hoặc kích thước riêng có thể truyền qua `className`; utility có độ ưu tiên sau lớp component. Tránh thêm màu hex mới cho cùng vai trò đã có token.

## CSS theo phạm vi

`tokens.css` chứa theme; `base.css` chứa font/reset/accessibility; `components.css` chứa control, scroll và toast; `app/styles/shell.css` chứa bố cục app; `features/map/styles/map.css` chứa điều khiển MapLibre và marker. File `app/styles.css` chỉ lắp ghép.

Giữ kích thước chữ ô nhập tối thiểu 16 px trên màn hình nhỏ để tránh Safari tự zoom, vòng focus rõ và reduced-motion. Kiểm tra desktop 1440×1000 và mobile 390×844 bằng script browser; primitive có test submit/loading/ref/validation, combobox có test bàn phím, lỗi resolve và huỷ request.
