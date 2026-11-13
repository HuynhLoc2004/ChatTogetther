/**
 * HỆ THỐNG CHỦ ĐỀ GIAO DIỆN PHÒNG CHAT (TALOVIN CHAT THEMES)
 * Thiết kế: Minimalist, giảm màu mè lòe loẹt, tập trung vào độ tương phản cao, dễ đọc
 * Dễ dàng mở rộng bởi Quản trị viên (Admin) thông qua cấu hình JSON
 */

export const CHAT_THEMES = [
  {
    id: 'obsidian',
    name: 'Obsidian Zinc (Mặc định)',
    tag: 'Tối Giản Chuẩn Mực',
    bg: '#09090b',
    headerBg: '#121215',
    sidebarBg: '#101014',
    border: '#27272a',
    myBubbleBg: '#27272a',
    myBubbleText: '#f4f4f5',
    theirBubbleBg: '#18181b',
    theirBubbleText: '#e4e4e7',
    senderColor: '#a1a1aa',
    accent: '#71717a',
    inputBg: '#121215'
  },
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    tag: 'Bầu Trời Đêm',
    bg: '#030712',
    headerBg: '#0b0f19',
    sidebarBg: '#090d16',
    border: '#1f2937',
    myBubbleBg: '#312e81',
    myBubbleText: '#f8fafc',
    theirBubbleBg: '#111827',
    theirBubbleText: '#e2e8f0',
    senderColor: '#818cf8',
    accent: '#6366f1',
    inputBg: '#0b0f19'
  },
  {
    id: 'emerald',
    name: 'Emerald Deep Forest',
    tag: 'Rừng Xanh Tĩnh Lặng',
    bg: '#021814',
    headerBg: '#05241e',
    sidebarBg: '#041f1a',
    border: '#064e3b',
    myBubbleBg: '#065f46',
    myBubbleText: '#ecfdf5',
    theirBubbleBg: '#064e3b',
    theirBubbleText: '#d1fae5',
    senderColor: '#34d399',
    accent: '#10b981',
    inputBg: '#05241e'
  },
  {
    id: 'charcoal',
    name: 'Monokai Charcoal',
    tag: 'Trầm Ấm Lập Trình',
    bg: '#141414',
    headerBg: '#1c1c1c',
    sidebarBg: '#181818',
    border: '#2c2c2c',
    myBubbleBg: '#2d3748',
    myBubbleText: '#f7fafc',
    theirBubbleBg: '#222222',
    theirBubbleText: '#edf2f7',
    senderColor: '#f6ad55',
    accent: '#ed8936',
    inputBg: '#1c1c1c'
  },
  {
    id: 'amethyst',
    name: 'Amethyst Twilight',
    tag: 'Hoàng Hôn Tím',
    bg: '#0c0714',
    headerBg: '#160d24',
    sidebarBg: '#120b1e',
    border: '#2e1065',
    myBubbleBg: '#581c87',
    myBubbleText: '#faf5ff',
    theirBubbleBg: '#241438',
    theirBubbleText: '#f3e8ff',
    senderColor: '#c084fc',
    accent: '#a855f7',
    inputBg: '#160d24'
  }
];

export const getThemeById = (themeId) => {
  return CHAT_THEMES.find(t => t.id === themeId) || CHAT_THEMES[0];
};

