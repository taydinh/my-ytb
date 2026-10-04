# Yêu Từ Pé

Ứng dụng Windows nhỏ gọn để xem video YouTube trong cửa sổ luôn nổi trên các ứng dụng khác.

## Chức năng

- Dán URL YouTube và nhấn Enter để phát.
- Mở YouTube Home trong panel gắn liền bên phải để tìm kiếm, duyệt đề xuất và xem channel mà không che trình phát; kéo thanh chia để đổi độ rộng, panel có thể đóng riêng và tự đóng khi chuyển sang khung nổi.
- Hỗ trợ link `youtube.com/watch`, `youtu.be`, Shorts, Live và Embed.
- Ghim cửa sổ luôn trên cùng.
- Chế độ khung nổi 16:9, kéo thay đổi kích thước tự do.
- Điều chỉnh độ trong suốt.
- Bật/tắt loop để tự động phát lại video khi kết thúc; lựa chọn được ghi nhớ.
- Điều khiển Play/Stop bằng âm thanh búng tay (Finger Snap) thu từ microphone; có thể bật/tắt nhanh trên thanh công cụ hoặc tinh chỉnh độ nhạy, thời gian chờ và thử micro trong bảng Cài đặt.
- Phím tắt kiểu YouTube: `J` lùi 10 giây, `K` phát/tạm dừng và `L` tiến 10 giây.
- Nhớ vị trí, kích thước và URL gần nhất.
- Tự chuyển sang chế độ xem tương thích khi chủ video hoặc YouTube không cho phép phát dạng embed.
- Chế độ gọn tự tua nhanh quảng cáo đến cuối, tắt tiếng trong khoảnh khắc xử lý và bấm nút Skip ngay khi YouTube cung cấp nút đó.
- Chặn quảng cáo bằng bộ lọc Ghostery trong phiên YouTube trên Windows; công tắc riêng được ghi nhớ, mặc định bật.
- Nút Tải lại áp dụng đầy đủ thay đổi bộ lọc và cố khôi phục vị trí, âm lượng, tốc độ, trạng thái tạm dừng của video thường.

### Điều khiển bằng âm thanh búng tay (Finger Snap Control)

- **Nguyên lý hoạt động**: Sử dụng Web Audio API tích hợp sẵn với bộ lọc dải tần kép (Dual-Band Filter): dải búng tay tần số cao (~3.8 kHz) và dải đối chứng tần số thấp (< 1.0 kHz). Thuật toán phân tích tỷ lệ năng lượng phổ (Spectral Energy Ratio), độ nhọn xung tức thời (Crest Factor) và tốc độ suy giảm năng lượng nhanh (Fast Decay) để nhận diện chính xác tiếng búng ngón tay, đồng thời loại trừ triệt để tiếng nói chuyện, tiếng nhạc loa và tiếng gõ mặt bàn.
- **Bật/tắt**:
  - Nhấn nút **`🤌 Búng tay`** trên thanh công cụ hoặc khung nổi để bật/tắt nhanh.
  - Hoặc mở **`⚙ Cài đặt`**, bật công tắc **Điều khiển bằng búng tay**.
- **Bảng Cài đặt & Kiểm tra trực tiếp**:
  - **Trạng thái Micro**: Hiển thị rõ `🟢 Đang lắng nghe`, `⚪ Đã tắt` hoặc `🔴 Lỗi micro`.
  - **Thước đo âm lượng trực tiếp (VU Meter)**: Hiển thị mức tín hiệu mic thời gian thực kèm nhãn `✓ Đã nhận diện!` chớp sáng khi búng tay, giúp người dùng kiểm tra ngay trước khi xem video.
  - **Độ nhạy (Sensitivity)**: Điều chỉnh từ 1% đến 100% (mặc định 60%). Mức cao sẽ nhạy hơn với tiếng búng tay nhẹ; mức thấp giúp giảm thiểu kích hoạt nhầm.
  - **Thời gian chờ (Cooldown)**: 0.5s / 0.8s / 1.2s giúp chống kích hoạt đúp hoặc tiếng vang phòng.
- **Phản hồi trực quan**: Khi nhận diện thành công tiếng búng tay, ứng dụng hiển thị thông báo HUD sinh động trên khung phát (`🤌 Tiếp tục phát` hoặc `🤌 Tạm dừng`) và cập nhật thanh trạng thái.
- **Quyền riêng tư**: Khi tắt tính năng, ứng dụng ngắt hoàn toàn MediaStream track, tắt đèn báo microphone trên Windows taskbar.

### Chặn quảng cáo trên Windows

Bộ lọc đóng gói sẵn hoạt động trước khi tải YouTube, áp dụng cả YouTube Home và khung phát. Khi bật, ứng dụng kiểm tra bản cập nhật trong nền (cache tối đa một ngày); bộ lọc tải thành công được dùng ở lần khởi động sau. Mất mạng vẫn dùng bộ lọc đã lưu hoặc bản đóng gói. Nếu không khởi động được bộ chặn, giao diện báo lỗi và tính năng tự Skip vẫn dùng được qua Chế độ gọn.

Nếu video gặp lỗi phát, tắt **Chặn quảng cáo**, rồi nhấn **Tải lại** nếu cần. Bật/tắt không tự tải lại video. CSS/script của bộ lọc đã chạy trong trang chỉ được loại bỏ hoàn toàn khi tải lại. Tính năng khôi phục vị trí không áp dụng cho livestream và chỉ thực hiện được khi trình phát tải được nội dung chính.

Bộ lọc dùng `@ghostery/adblocker-electron` (MPL-2.0) và các danh sách ads-only do dự án Ghostery duy trì, gồm EasyList và bộ lọc uBlock Origin. Nguồn, giấy phép và script tài nguyên: https://github.com/ghostery/adblocker/tree/master/packages/adblocker/assets . Không bảo đảm chặn mọi quảng cáo YouTube; nội dung tài trợ nằm trong chính video không được loại bỏ.

Trước khi phát hành có thể cập nhật bộ lọc đóng gói bằng `npm run adblock:update`. Chạy kiểm thử Windows bằng `npm run test:windows`; kiểm thử tích hợp Electron nằm tại `tests/windows-electron-smoke.cjs` và dùng profile tạm.

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

```
npm run pack 
```
//D:\Vibe Coding\my-ytp\dist\win-unpacked

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

- `J`: tua lùi 10 giây.
- `K`: phát/tạm dừng.
- `L`: tua tiến 10 giây.
- `Ctrl+P`: bật/tắt ghim cửa sổ.
- `Esc`: thoát chế độ khung nổi.

> Lưu ý: YouTube thường xuyên thay đổi giao diện và cơ chế phân phối quảng cáo. Bộ chặn trên Windows và tự bấm Skip đều là tính năng best-effort; YouTube có thể từ chối phát khi phát hiện bộ chặn. iOS tiếp tục chỉ tự bấm Skip, không chặn request.
