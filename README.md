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

Trình phát iOS dùng một `WKWebView` trong vùng video, tải HTML nhúng với `baseURL` HTTPS lấy từ bundle ID để gửi `Referer` theo yêu cầu của YouTube và tránh lỗi 153. Cầu nối được đăng ký trong `capacitorDidLoad()` vì Capacitor thay thế `userContentController` sau bước cấu hình WebView. Sau khi sửa mã mobile/native, chạy `npm run ios:sync` rồi build và cài lại bằng Xcode.

Nút “Mở YouTube” trên iOS mở màn hình duyệt `WKWebView` có nút Quay lại và Đóng. Khi chọn video thường, Shorts hoặc livestream, ứng dụng chặn điều hướng trong màn hình duyệt, đóng màn hình này, cập nhật URL và yêu cầu tự phát trong trình phát chính. Script `mobile/ios-youtube-browser.js` bắt cả liên kết và điều hướng SPA; phía Swift kiểm tra lại nguồn gửi và ID video. Tìm kiếm và trang kênh vẫn được duyệt bình thường.

Kiểm tra tự động: `node --test tests/*.test.cjs`. Kiểm tra trên thiết bị sau khi build/cài lại: mở YouTube, tìm video và chạm kết quả; xác nhận màn hình duyệt đóng, URL được điền và chỉ trình phát chính phát âm thanh. Thử thêm Shorts, livestream, nút Đóng/Quay lại và mở lại màn hình duyệt. Nếu video bị YouTube hạn chế nhúng hoặc tự phát, có thể cần nhấn Play hoặc chọn video khác.

Trên iPhone/iPad, ứng dụng tự bấm nút Skip đang hiển thị và khả dụng trong khung phát, kiểm tra mỗi 0,5 giây khi ứng dụng đang hiển thị. Không tua video hoặc chặn request. Quảng cáo không cho bỏ qua vẫn phát bình thường. Tính năng không áp dụng cho Safari hay cửa sổ “Mở YouTube”, và có thể cần cập nhật khi YouTube đổi giao diện. Cần build/cài lại bản iOS sau `npm run ios:sync` để nhận thay đổi native này.

```powershell
npm run ios:web
npm run ios:sync
```

Việc biên dịch và ký ứng dụng iOS cần macOS, Xcode và Apple Account. Xem `ios/INSTALL_IPAD.md` để cài trực tiếp lên iPad hoặc xuất IPA.

### Âm thanh khi khóa màn hình iPhone

Bản native khai báo background mode `audio` và kích hoạt `AVAudioSession` với category `playback` khi người dùng chọn video. Đây là cấu hình iOS cho phép âm thanh tiếp tục khi khóa màn hình; không cần bật công tắc riêng. Chạy `npm run ios:sync`, build và cài lại ứng dụng bằng Xcode để nhận thay đổi.

Trình phát vẫn dùng YouTube nhúng trong `WKWebView`, không tách luồng audio. YouTube/WebKit có thể tạm dừng video khi ứng dụng vào nền; cấu hình này chưa đảm bảo phát nền với mọi video hoặc phiên bản iOS. Cần xác nhận trên iPhone thật: phát video có tiếng, khóa màn hình ít nhất 2 phút, mở khóa và kiểm tra vị trí phát không bị tải lại. Kiểm tra thêm khi chuyển ứng dụng, tạm dừng trước khi khóa, nhận cuộc gọi và tháo tai nghe; ứng dụng không được tự phát lại nội dung đã tạm dừng. Nếu YouTube dừng khi khóa, thử PiP nếu trình phát cung cấp; phát audio nền ổn định cần nguồn media được phép phát bằng trình phát native.

## Phím tắt

- `Ctrl+P`: bật/tắt ghim cửa sổ.
- `Esc`: thoát chế độ khung nổi.

> Lưu ý: YouTube thường xuyên thay đổi giao diện và cơ chế phân phối quảng cáo. Tự bấm Skip là tính năng best-effort; ứng dụng không can thiệp vào luồng video hoặc đảm bảo loại bỏ mọi quảng cáo. Ứng dụng không chặn request quảng cáo vì việc này có thể khiến YouTube từ chối phát video.
