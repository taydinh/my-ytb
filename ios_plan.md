# Kế hoạch và trạng thái phiên bản iOS/iPadOS

## Mục tiêu

Tạo một ứng dụng Capacitor riêng cho iPhone và iPad, tái sử dụng bộ phân tích URL nhưng không thay đổi mã nguồn Electron trong `src/` hoặc quy trình đóng gói Windows.

Phiên bản iOS sử dụng YouTube Embed chuẩn. Nó không inject script, không tự tua/bỏ qua quảng cáo và không ép phát nền. PiP chỉ được sử dụng khi trình phát YouTube và iOS cung cấp khả năng này.

## Kiến trúc đã chọn

- `src/`: ứng dụng Electron/Windows, giữ nguyên.
- `mobile/`: HTML, CSS và JavaScript nguồn riêng cho iOS.
- `www/`: web bundle được tạo tự động, không sửa thủ công.
- `ios/`: project Xcode do Capacitor quản lý.
- `src/url-parser.js`: phần dùng chung duy nhất giữa Windows và iOS.

## Trạng thái triển khai

- [x] Cài Capacitor 8 và Browser plugin dưới dạng development dependencies.
- [x] Tạo web build riêng bằng esbuild.
- [x] Tạo project Xcode hỗ trợ iPhone và iPad, deployment target iOS 15.
- [x] Responsive UI cho portrait, landscape và safe area bốn cạnh.
- [x] Phát link `watch`, `youtu.be`, `shorts`, `live`, `embed` và video ID.
- [x] Ghi nhớ URL gần nhất và trạng thái loop.
- [x] Mở YouTube bằng browser view chính thức.
- [x] Tạo App Icon và splash screen.
- [x] Kiểm tra lại quy trình đóng gói Windows.
- [ ] Build và ký file IPA trên macOS/Xcode bằng Apple Account của chủ thiết bị.
- [ ] Kiểm tra playback và PiP trên iPad thật.

## Các lệnh phát triển

```bash
npm install
npm run ios:web
npx cap add ios       # chỉ chạy khi thư mục ios chưa tồn tại
npm run ios:sync
npm run ios:assets
npm run ios:open
```

Sau mỗi thay đổi trong `mobile/`, chạy `npm run ios:sync` trước khi build bằng Xcode.

## Quyết định về PiP và background audio

`AVPictureInPictureController` không thể lấy trực tiếp video YouTube bên trong WKWebView làm nguồn phát. Bản iOS vì vậy cho phép quyền `picture-in-picture` trên iframe và hướng dẫn người dùng sử dụng nút PiP của player nếu nó xuất hiện. Không cam kết PiP cho mọi video/tài khoản/phiên bản iOS.

Không bật Background Audio capability chỉ để giữ YouTube chạy khi khóa màn hình. Việc này không bảo đảm hoạt động với WKWebView và không phù hợp với chính sách YouTube dành cho API client.

## Kiểm thử còn phải thực hiện trên macOS/thiết bị thật

1. Build Debug trên iPhone và iPad qua Xcode.
2. Thử portrait, landscape, Split View/Stage Manager và bàn phím hiện/ẩn.
3. Thử URL thường, rút gọn, Shorts, Live, video không cho embed, giới hạn tuổi và video riêng tư.
4. Thử mạng chậm, mất mạng, chuyển app, khóa màn hình và audio interruption.
5. Thử PiP từ player toàn màn hình; giao diện phải không hỏng nếu PiP không khả dụng.
6. Kiểm tra VoiceOver, Dynamic Type và vùng chạm nút.

## Phân phối

- Cài cá nhân: dùng Xcode với Personal Team; provisioning miễn phí hết hạn sau 7 ngày.
- Beta: dùng TestFlight với Apple Developer Program; mỗi build beta có hiệu lực tối đa 90 ngày.
- IPA Development/Ad Hoc: cần macOS, Xcode, Apple Developer signing identity và provisioning profile.
- App Store: cần đánh giá lại tên/branding, quyền sử dụng nội dung YouTube, App Privacy và giá trị độc lập theo App Review Guidelines.

Xem hướng dẫn chi tiết tại `ios/INSTALL_IPAD.md`.
