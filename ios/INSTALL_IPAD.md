# Cài Floating Video Player lên iPad

Project iOS đã được tạo trong `ios/App/App.xcodeproj`. Apple yêu cầu app iOS phải được biên dịch và ký bằng Xcode trên macOS. Windows không thể tạo file IPA hợp lệ và project không thể chứa sẵn chứng chỉ Apple của người dùng.

## Cách 1 — Cài trực tiếp bằng Xcode (khuyến nghị cho thiết bị cá nhân)

Yêu cầu: máy Mac có Xcode 26+, Node.js 22+, cáp USB hoặc kết nối Wi-Fi đã pair và Apple Account.

1. Chép toàn bộ project sang máy Mac.
2. Mở Terminal tại thư mục project và chạy:

   ```bash
   npm ci
   npm run ios:sync
   npm run ios:assets
   npm run ios:open
   ```

3. Trong Xcode, chọn target **App** → **Signing & Capabilities**.
4. Bật **Automatically manage signing** và chọn Team là Apple Account của bạn.
5. Nếu bundle identifier `com.local.youtubefloatingplayer` bị trùng, đổi thành một giá trị duy nhất, ví dụ `com.ten-cua-ban.floatingvideoplayer`.
6. Kết nối iPad, bật **Developer Mode** tại Settings → Privacy & Security → Developer Mode nếu iOS yêu cầu.
7. Chọn iPad ở thanh destination của Xcode rồi nhấn **Run**.
8. Nếu iPad yêu cầu tin cậy developer, vào Settings → General → VPN & Device Management và trust tài khoản tương ứng.

Với Personal Team miễn phí, provisioning profile hết hạn sau 7 ngày; khi đó cần build/cài lại từ Xcode.

## Cách 2 — Xuất IPA đã ký

Cách này cần membership Apple Developer phù hợp và provisioning profile Development hoặc Ad Hoc.

1. Hoàn tất Signing & Capabilities như trên.
2. Chọn **Any iOS Device (arm64)**.
3. Chọn Product → Archive.
4. Trong Organizer chọn Distribute App → Development hoặc Ad Hoc.
5. Chọn Automatically manage signing và Export.
6. Xcode sẽ tạo file `.ipa`, có thể cài bằng Apple Configurator hoặc hệ thống MDM phù hợp với profile đã ký.

Có thể chạy `./scripts/build-ios-ipa.sh` trên Mac sau khi signing của project đã được cấu hình. File xuất ra nằm trong `release/ios/export/`.

## Cách 3 — TestFlight

1. Tạo app trong App Store Connect bằng bundle identifier đã cấu hình.
2. Trong Xcode Organizer chọn Distribute App → App Store Connect → Upload.
3. Thêm tester trong tab TestFlight của App Store Connect.
4. Cài ứng dụng TestFlight trên iPad và nhận bản build.

External TestFlight có thể yêu cầu beta review. Mỗi build TestFlight dùng được tối đa 90 ngày.

## Cập nhật mã nguồn

Sau khi sửa file trong `mobile/`, luôn chạy:

```bash
npm run ios:sync
```

Sau đó build lại bằng Xcode. Không sửa file trong `ios/App/App/public/` vì Capacitor sẽ ghi đè thư mục này.

## Giới hạn đã biết

- PiP phụ thuộc trình phát YouTube, video, tài khoản và phiên bản iOS; không phải video nào cũng hiện nút PiP.
- App không tự động bỏ qua quảng cáo và không ép YouTube phát khi khóa màn hình.
- Một số video chặn embed, giới hạn độ tuổi hoặc yêu cầu đăng nhập có thể không phát trong app.
