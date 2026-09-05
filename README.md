# YouTube Hacking Player - a ụt

Ứng dụng Windows nhỏ gọn để xem video YouTube trong cửa sổ luôn nổi trên các ứng dụng khác.

## Chức năng

- Dán URL YouTube và nhấn Enter để phát.
- Mở YouTube Home để tìm kiếm, duyệt đề xuất và xem channel như trên trình duyệt; khi chọn video, ứng dụng tự chuyển về khung phát cố định.
- Hỗ trợ link `youtube.com/watch`, `youtu.be`, Shorts, Live và Embed.
- Ghim cửa sổ luôn trên cùng.
- Chế độ khung nổi 16:9, kéo thay đổi kích thước tự do.
- Điều chỉnh độ trong suốt.
- Bật/tắt loop để tự động phát lại video khi kết thúc; lựa chọn được ghi nhớ.
- Nhớ vị trí, kích thước và URL gần nhất.
- Tự chuyển sang chế độ xem tương thích khi chủ video hoặc YouTube không cho phép phát dạng embed.
- Chế độ gọn tự tua nhanh quảng cáo đến cuối, tắt tiếng trong khoảnh khắc xử lý và bấm nút Skip ngay khi YouTube cung cấp nút đó.

## Chạy trong môi trường phát triển

```powershell
npm install
npm start
```

## Đóng gói cho Windows

```powershell
npm run dist
```

File cài đặt và bản portable sẽ nằm trong thư mục `dist`.

## Phiên bản iPhone và iPad

Mã nguồn mobile được tách riêng trong thư mục `mobile`, project Xcode nằm trong `ios`; ứng dụng Electron trong `src` không bị thay đổi.

```powershell
npm run ios:web
npm run ios:sync
```

Việc biên dịch và ký ứng dụng iOS cần macOS, Xcode và Apple Account. Xem `ios/INSTALL_IPAD.md` để cài trực tiếp lên iPad hoặc xuất IPA.

## Phím tắt

- `Ctrl+P`: bật/tắt ghim cửa sổ.
- `Esc`: thoát chế độ khung nổi.

> Lưu ý: YouTube thường xuyên thay đổi giao diện và cơ chế phân phối quảng cáo. Tự bấm Skip là tính năng best-effort; ứng dụng không can thiệp vào luồng video hoặc đảm bảo loại bỏ mọi quảng cáo. Ứng dụng không chặn request quảng cáo vì việc này có thể khiến YouTube từ chối phát video.
