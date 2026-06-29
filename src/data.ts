export type AccountStatus = "active" | "blocked" | "restricted";

export const accounts = [
  { id: 1, phone: "+966501234567", name: "أحمد", username: "@ahmed", status: "active" as AccountStatus, proxy: "185.12.45.10:1080", lastUsed: "قبل 5 دقائق", age: "8 أشهر", groups: 14 },
  { id: 2, phone: "+966552345678", name: "سارة", username: "@sara", status: "active" as AccountStatus, proxy: "—", lastUsed: "قبل ساعة", age: "3 أشهر", groups: 8 },
  { id: 3, phone: "+966563456789", name: "خالد", username: "@khaled", status: "restricted" as AccountStatus, proxy: "94.21.10.5:1080", lastUsed: "أمس", age: "سنة", groups: 22 },
  { id: 4, phone: "+966574567890", name: "نورة", username: "@noura", status: "blocked" as AccountStatus, proxy: "—", lastUsed: "قبل 3 أيام", age: "شهر", groups: 0 },
  { id: 5, phone: "+966585678901", name: "فهد", username: "@fahd", status: "active" as AccountStatus, proxy: "77.40.22.8:1080", lastUsed: "قبل 10 دقائق", age: "سنتان", groups: 31 },
  { id: 6, phone: "+966596789012", name: "ريم", username: "@reem", status: "active" as AccountStatus, proxy: "—", lastUsed: "قبل 30 دقيقة", age: "5 أشهر", groups: 11 },
];

export const proxies = [
  { id: 1, addr: "185.12.45.10:1080", type: "SOCKS5", status: "active", speed: "120ms", linked: "أحمد" },
  { id: 2, addr: "94.21.10.5:1080", type: "SOCKS5", status: "active", speed: "210ms", linked: "خالد" },
  { id: 3, addr: "77.40.22.8:1080", type: "SOCKS4", status: "active", speed: "95ms", linked: "فهد" },
  { id: 4, addr: "203.0.113.5:8080", type: "HTTP", status: "dead", speed: "—", linked: "—" },
  { id: 5, addr: "198.51.100.7:1080", type: "SOCKS5", status: "slow", speed: "880ms", linked: "—" },
];

export const exportedFiles = [
  { id: 1, name: "members_groupA_2026-06-28.csv", members: 15340, date: "2026-06-28" },
  { id: 2, name: "active_users_2026-06-27.csv", members: 4210, date: "2026-06-27" },
  { id: 3, name: "target_list_2026-06-25.csv", members: 9971, date: "2026-06-25" },
];

export const campaigns = [
  { id: 1, name: "حملة تسويق منتج", groups: 24, progress: 72, date: "2026-06-28", status: "active" as const, sent: 63, total: 87 },
  { id: 2, name: "حملة تداول", groups: 12, progress: 100, date: "2026-06-20", status: "done" as const, sent: 120, total: 120 },
  { id: 3, name: "حملة عروض رمضان", groups: 8, progress: 35, date: "2026-06-29", status: "paused" as const, sent: 18, total: 50 },
  { id: 4, name: "حملة تعليمية", groups: 0, progress: 0, date: "2026-06-29", status: "draft" as const, sent: 0, total: 0 },
];

export const dmCampaigns = [
  { id: 1, name: "DM تسويق", recipients: 1000, progress: 45, date: "2026-06-28", status: "active" as const, sent: 450, total: 1000 },
  { id: 2, name: "DM عروض", recipients: 500, progress: 100, date: "2026-06-22", status: "done" as const, sent: 500, total: 500 },
  { id: 3, name: "DM مسودة", recipients: 0, progress: 0, date: "2026-06-29", status: "draft" as const, sent: 0, total: 0 },
];

export const templates = [
  { id: 1, name: "عرض تسويقي", type: "نص + صورة", category: "تسويق", lastUsed: "2026-06-28" },
  { id: 2, name: "دعوة تداول", type: "نص فقط", category: "تداول", lastUsed: "2026-06-20" },
  { id: 3, name: "درس تعليمي", type: "نص + مستند", category: "تعليم", lastUsed: "2026-06-15" },
];

export const logs = [
  { id: 1, date: "2026-06-28 14:32", group: "@market_sa", extracted: 15340, file: "members_groupA.csv" },
  { id: 2, date: "2026-06-27 10:15", group: "@crypto_world", extracted: 4210, file: "active_users.csv" },
  { id: 3, date: "2026-06-25 09:00", group: "@offers_daily", extracted: 9971, file: "target_list.csv" },
];

export const addLogs = [
  { id: 1, date: "2026-06-28", file: "members_groupA.csv", target: "@my_group", success: 14000, fail: 1340 },
  { id: 2, date: "2026-06-24", file: "active_users.csv", target: "@my_group", success: 3900, fail: 310 },
];

export const errorLogs = [
  { id: 1, time: "2026-06-28 14:35", error: "FloodWait 300s", account: "+966501234567", fix: "تبديل تلقائي" },
  { id: 2, time: "2026-06-28 14:20", error: "UserPrivacyException", account: "+966552345678", fix: "تخطي" },
  { id: 3, time: "2026-06-27 10:30", error: "ChannelPrivate", account: "+966563456789", fix: "إضافة للقائمة السوداء" },
];

export const blacklist = [
  { id: 1, user: "@spammer1", reason: "بوت", date: "2026-06-20" },
  { id: 2, user: "123456789", reason: "محظور يدوياً", date: "2026-06-18" },
];

export const groups = [
  { id: 1, name: "@market_sa", type: "عام", members: 15340, category: "تسويق" },
  { id: 2, name: "@crypto_world", type: "عام", members: 4210, category: "تداول" },
  { id: 3, name: "@offers_daily", type: "عام", members: 9971, category: "عروض" },
  { id: 4, name: "@edu_hub", type: "خاص", members: 2300, category: "تعليم" },
  { id: 5, name: "@tech_news", type: "عام", members: 18700, category: "تقنية" },
];

export const schedules = [
  { id: 1, campaign: "حملة تسويق منتج", pattern: "يومياً 10:00", next: "2026-06-30 10:00", runs: 5, status: "active" },
  { id: 2, campaign: "حملة تداول", pattern: "أسبوعياً", next: "2026-07-04 09:00", runs: 12, status: "paused" },
];
