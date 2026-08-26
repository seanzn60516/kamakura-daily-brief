// =============================================================
// 鎌倉市 植木地区 ゴミ収集スケジュール
// =============================================================
// ⚠️ TODO: 現在は仮データです。
// 鎌倉市公式サイトの「地区別収集カレンダー」で植木地区の
// 正確な収集曜日を確認し、下記 SCHEDULE を書き換えてください。
// 参考: https://www.city.kamakura.kanagawa.jp/imacs/day.html
// 参考: https://www.city.kamakura.kanagawa.jp/gomi/chikubetsu.html
//
// 令和8年(2026年)4月から植木地区は収集曜日が変更されている
// 可能性があるため、最新のPDFカレンダーで必ず確認すること。
// =============================================================

// 曜日ベースの品目（毎週）
// 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
const WEEKLY_SCHEDULE = {
  1: ["飲食用カン・ビン", "植木剪定材"],                 // 月曜 TODO
  2: ["燃やすごみ"],        // 火曜 TODO
  3: ["紙類", "布類", "ペットボトル"], // 水曜 TODO
  4: ["包装容器プラスチック"],                 // 木曜 TODO
  5: ["燃やすごみ"], // 金曜 TODO
};

// 月◯回目の水曜日などの不定期品目（TODOで正確な回次に差し替え）
// 例: 第1・3水曜日に「燃えないごみ」など
const MONTHLY_SCHEDULE = [
  {
    item: "燃えないごみ・危険有害ごみ・使用済み食用油",
    dayOfWeek: 4, // 木曜日 TODO
    weekOfMonth: [1], // 第1 TODO
  },
  {
    item: "製品プラスチック",
    dayOfWeek: 4, // 木曜日 TODO
    weekOfMonth: [4], // 第4 TODO
  },
];

function getWeekOfMonth(date) {
  return Math.ceil(date.getDate() / 7);
}

export function getTodayTrashItems(date = new Date()) {
  const dow = date.getDay();
  const items = [...(WEEKLY_SCHEDULE[dow] ?? [])];

  const week = getWeekOfMonth(date);
  for (const rule of MONTHLY_SCHEDULE) {
    if (rule.dayOfWeek === dow && rule.weekOfMonth.includes(week)) {
      items.push(rule.item);
    }
  }

  if (items.length === 0) {
    return ["この曜日の収集はありません(仮データ・要確認)"];
  }
  return items;
}

export const IS_PLACEHOLDER_DATA = true;
