import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { getTodayTrashItems, IS_PLACEHOLDER_DATA } from "./trash-schedule.mjs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const today = new Date();
const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const dateLabel = jstFormatter.format(today);
const isoDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(today); // YYYY-MM-DD

// --- 1. Claude APIでコンテンツ生成 ---------------------------------

const PROMPT = `あなたは日本の個人投資家・子育て中の親向けの朝刊ブリーフを作成するライターです。
以下のJSON形式で、今日(${dateLabel})時点の情報をもとに出力してください。
Web検索ツールを使って、実際の最新の市場ニュースを踏まえてください。

出力は必ず以下のJSONのみ。前後の説明文やコードブロック記号は一切付けないこと。

{
  "investment": {
    "summary": "今日の市場全体の注目トピックを2〜3文で",
    "picks": [
      {"name": "銘柄名または投資信託名", "type": "個別株 or 投資信託", "reason": "注目されている理由(客観的な事実ベース、推奨ではなく紹介として)"}
    ]
  },
  "newborn_tip": {
    "title": "今日の育児tipsのタイトル",
    "body": "3〜4文程度の具体的で実践的な新生児の育て方tips"
  },
  "skincare_tip": {
    "title": "今日のスキンケアtipsのタイトル",
    "body": "3〜4文程度の具体的で実践的なスキンケアtips"
  }
}

注意:
- investment.picksは3件程度。特定銘柄への投資を推奨する表現は避け、「注目されている理由」を客観的に紹介する形にすること。
- これは金融アドバイスではないことを前提とした客観的な情報提供とすること。
- 内容は毎日変化をつけ、同じような内容の繰り返しを避けること。`;

async function generateContent() {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: PROMPT }],
  });

  const textBlocks = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude APIの応答からJSONを抽出できませんでした: " + textBlocks);
  }
  return JSON.parse(jsonMatch[0]);
}

// --- 2. HTML生成 -----------------------------------------------------

function renderHtml({ content, trashItems }) {
  const picksHtml = content.investment.picks
    .map(
      (p) => `
      <li>
        <strong>${escapeHtml(p.name)}</strong>（${escapeHtml(p.type)}）<br>
        <span class="reason">${escapeHtml(p.reason)}</span>
      </li>`
    )
    .join("\n");

  const trashHtml = trashItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>デイリーブリーフ ${dateLabel}</title>
<style>
  body { font-family: -apple-system, "Hiragino Kaku Gothic ProN", sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background: #f7f7f8; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  section { background: white; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h2 { font-size: 1.05rem; margin-top: 0; border-left: 4px solid #444; padding-left: 8px; }
  .reason { color: #555; font-size: 0.92rem; }
  .warning { color: #b45309; font-size: 0.85rem; }
  .disclaimer { color: #888; font-size: 0.8rem; margin-top: 24px; }
  ul { padding-left: 1.2em; }
</style>
</head>
<body>
  <h1>📋 デイリーブリーフ — ${dateLabel}</h1>

  <section>
    <h2>🗑 今日のゴミ出し(植木地区)</h2>
    <ul>${trashHtml}</ul>
    ${IS_PLACEHOLDER_DATA ? '<p class="warning">⚠️ このデータは仮設定です。公式カレンダーで確認後、正式な内容に差し替えてください。</p>' : ""}
  </section>

  <section>
    <h2>📈 投資ピックアップ</h2>
    <p>${escapeHtml(content.investment.summary)}</p>
    <ul>${picksHtml}</ul>
  </section>

  <section>
    <h2>👶 新生児の育て方tips</h2>
    <h3>${escapeHtml(content.newborn_tip.title)}</h3>
    <p>${escapeHtml(content.newborn_tip.body)}</p>
  </section>

  <section>
    <h2>✨ スキンケアtips</h2>
    <h3>${escapeHtml(content.skincare_tip.title)}</h3>
    <p>${escapeHtml(content.skincare_tip.body)}</p>
  </section>

  <p class="disclaimer">
    ※ 投資情報は情報提供を目的としたものであり、投資勧誘や助言を意図したものではありません。
    投資判断はご自身の責任で行ってください。
  </p>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// --- 3. メイン処理 -----------------------------------------------------

async function main() {
  const content = await generateContent();
  const trashItems = getTodayTrashItems(today);
  const html = renderHtml({ content, trashItems });

  const docsDir = path.resolve("docs");
  const archiveDir = path.join(docsDir, "archive");
  await fs.mkdir(archiveDir, { recursive: true });

  await fs.writeFile(path.join(docsDir, "index.html"), html, "utf-8");
  await fs.writeFile(path.join(archiveDir, `${isoDate}.html`), html, "utf-8");

  console.log(`生成完了: docs/index.html (${isoDate})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
