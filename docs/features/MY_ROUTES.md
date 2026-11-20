# Tuyến đã lưu

Web đã triển khai lưu tuyến trong trình duyệt qua `SavedRouteRepository` và `LocalStorageSavedRouteRepository` ở `apps/web/src/features/my-routes`. Khôi phục tuyến giữ điểm ghé và phương tiện, rồi tính lại dữ liệu đường hiện tại.

Backend chưa có API lưu tuyến cá nhân. Khi triển khai đồng bộ nhiều thiết bị, bổ sung use case lưu/liệt kê/đổi tên/xoá theo chủ sở hữu, port repository, adapter Supabase và chính sách RLS. Không coi tài liệu kế hoạch này là endpoint đang hoạt động.
