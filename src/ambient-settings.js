(function exposeAmbientSettings(root) {
  const STORAGE_KEY = 'ambientSettings';
  const range = (key, label, min, max, step, unit, value, desc) => ({ key, type: 'range', label, min, max, step, unit, value, desc });
  const toggle = (key, label, value, desc) => ({ key, type: 'toggle', label, value, desc });

  const GROUPS = [
    { title: 'Ánh sáng nền', fields: [
      toggle('extend', 'Nối liền với video', true, 'Nền là phần mở rộng của mép video, như video tràn ra ngoài. Bỏ qua độ đậm, độ lan, bão hòa, độ sáng nền, nhiễu, bóng đổ và chuyển động để màu khớp liền mạch.'),
      range('intensity', 'Độ đậm', 0, 100, 1, '%', 85),
      range('blur', 'Độ mờ', 0, 120, 1, 'px', 30),
      range('spread', 'Độ lan', 0, 40, 1, '%', 20),
      range('saturation', 'Độ bão hòa', 0, 300, 5, '%', 150),
      range('brightness', 'Độ sáng', 0, 200, 5, '%', 100),
      range('colorSpeed', 'Tốc độ chuyển màu', 1, 100, 1, '%', 6, 'Thấp = chuyển màu chậm và mượt hơn.'),
      range('fadeIn', 'Thời gian hiện dần', 0, 3, 0.1, 's', 0.6),
      range('noise', 'Chống sọc màu (nhiễu)', 0, 30, 1, '%', 8, 'Thêm nhiễu rất nhẹ để nền không bị sọc từng dải màu.')
    ] },
    { title: 'Chuyển động nền', fields: [
      toggle('motion', 'Chuyển động nhẹ', true, 'Nền vẫn trôi chậm khi hình ảnh đứng yên.'),
      range('motionDuration', 'Chu kỳ', 3, 60, 1, 's', 9),
      range('motionAmount', 'Biên độ', 0, 200, 5, '%', 100)
    ] },
    { title: 'Video & bộ lọc', fields: [
      range('videoSize', 'Kích thước video', 50, 100, 1, '%', 86),
      range('shadowSize', 'Bóng đổ', 0, 100, 1, 'px', 20),
      range('shadowOpacity', 'Độ đậm bóng', 0, 100, 1, '%', 50),
      range('videoBrightness', 'Độ sáng video', 0, 200, 5, '%', 100),
      range('videoContrast', 'Độ tương phản video', 0, 200, 5, '%', 100),
      range('videoSaturation', 'Độ bão hòa video', 0, 200, 5, '%', 100),
      toggle('top', 'Phát sáng phía trên', true),
      toggle('right', 'Phát sáng bên phải', true),
      toggle('bottom', 'Phát sáng phía dưới', true),
      toggle('left', 'Phát sáng bên trái', true)
    ] },
    { title: 'Hiệu năng & viền đen', fields: [
      range('fps', 'Giới hạn khung hình', 0, 60, 5, 'fps', 30, '0 = không giới hạn. Thấp hơn giúp nhẹ máy hơn.'),
      range('resolution', 'Độ phân giải nền', 16, 256, 16, 'px', 160, 'Nền đã được làm mờ nên độ phân giải thấp vẫn đẹp.'),
      toggle('removeBars', 'Bỏ viền đen', false, 'Tự phát hiện viền đen trong video, để ánh sáng nền lấp vào chỗ đó.'),
      range('barThreshold', 'Ngưỡng phát hiện viền', 1, 30, 1, '%', 6, 'Tăng nếu viền đen không được nhận ra; giảm nếu cảnh tối bị cắt nhầm.')
    ] }
  ];
  const FIELDS = GROUPS.flatMap((group) => group.fields);
  const DEFAULTS = Object.fromEntries(FIELDS.map((field) => [field.key, field.value]));

  // Values come from localStorage and are injected into the YouTube page: keep only known, clamped values.
  function sanitize(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    return Object.fromEntries(FIELDS.map((field) => {
      const value = input[field.key];
      if (field.type === 'toggle') return [field.key, typeof value === 'boolean' ? value : field.value];
      const number = Number(value);
      if (value === null || value === '' || !Number.isFinite(number)) return [field.key, field.value];
      const stepped = Math.round((Math.min(field.max, Math.max(field.min, number)) - field.min) / field.step) * field.step + field.min;
      return [field.key, Number(stepped.toFixed(2))];
    }));
  }

  function load(storage) {
    try { return sanitize(JSON.parse(storage.getItem(STORAGE_KEY) || '{}')); }
    catch { return { ...DEFAULTS }; }
  }

  function save(storage, settings) {
    const clean = sanitize(settings);
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function format(field, value) {
    if (field.key === 'fps' && value === 0) return 'Không giới hạn';
    return `${value}${field.unit === '%' ? '%' : ` ${field.unit}`}`;
  }

  const api = { GROUPS, FIELDS, DEFAULTS, sanitize, load, save, format };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AmbientSettings = api;
})(typeof window !== 'undefined' ? window : globalThis);
