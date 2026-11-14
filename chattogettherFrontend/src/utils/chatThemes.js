/**
 * HỆ THỐNG CHỦ ĐỀ GIAO DIỆN PHÒNG CHAT (TALOVIN CHAT THEMES)
 * Thiết kế: Chuẩn Dark Zinc (#09090b) tối giản, loại bỏ hoàn toàn màu xanh rêu / tím lòe loẹt.
 * Đồng bộ với phong cách Linear / Discord Dark Zinc tinh tế.
 */

export const CHAT_THEMES = [
  {
    id: 'obsidian',
    name: 'Obsidian Zinc (Mặc định)',
    tag: 'Dark Zinc #09090b',
    bg: '#09090b',
    headerBg: '#0f0f12',
    sidebarBg: '#0c0d10',
    border: '#27272a',
    myBubbleBg: '#27272a',
    myBubbleText: '#f4f4f5',
    theirBubbleBg: '#18181b',
    theirBubbleText: '#e4e4e7',
    senderColor: '#a1a1aa',
    accent: '#71717a',
    inputBg: '#0f0f12'
  },
  {
    id: 'slate',
    name: 'Deep Slate Zinc',
    tag: 'Xám Đen Tối Giản',
    bg: '#08090c',
    headerBg: '#0e1015',
    sidebarBg: '#0b0c11',
    border: '#1e2129',
    myBubbleBg: '#1e222d',
    myBubbleText: '#f8fafc',
    theirBubbleBg: '#12141a',
    theirBubbleText: '#e2e8f0',
    senderColor: '#94a3b8',
    accent: '#64748b',
    inputBg: '#0e1015'
  },
  {
    id: 'pure_black',
    name: 'Pure Onyx (OLED)',
    tag: 'Đen Tuyệt Đối',
    bg: '#000000',
    headerBg: '#080808',
    sidebarBg: '#050505',
    border: '#1c1c1c',
    myBubbleBg: '#222222',
    myBubbleText: '#ffffff',
    theirBubbleBg: '#111111',
    theirBubbleText: '#d4d4d8',
    senderColor: '#a1a1aa',
    accent: '#52525b',
    inputBg: '#080808'
  },
  {
    id: 'contrast_white',
    name: 'Zinc White Accent',
    tag: 'Tương Phản Cao Cấp',
    bg: '#09090b',
    headerBg: '#111114',
    sidebarBg: '#0d0d10',
    border: '#27272a',
    myBubbleBg: '#ffffff',
    myBubbleText: '#09090b',
    theirBubbleBg: '#18181b',
    theirBubbleText: '#f4f4f5',
    senderColor: '#d4d4d8',
    accent: '#ffffff',
    inputBg: '#111114'
  }
];

export const getThemeById = (themeId) => {
  return CHAT_THEMES.find(t => t.id === themeId) || CHAT_THEMES[0];
};
