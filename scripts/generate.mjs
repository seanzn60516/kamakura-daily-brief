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
検索を行った場合でも、最終的な返答メッセージは説明文を一切含まず、JSONオブジェクト1つだけにすること。

{
  "investment": {
    "summary": "今日の市場全体の注目トピックを2〜3文で",
    "picks": [
      {"name": "銘柄名または投資信託名", "type": "個別株 or 投資信託", "reason": "注目されている理由(客観的な事実ベース、推奨ではなく紹介として)", "source_url": "情報源となった記事の実際のURL"}
    ]
  },
  "autonomous_driving": {
    "summary": "今日時点での自動運転技術に関する注目トピックを2〜3文で",
    "highlights": [
      {"topic": "企業名・技術名・地域など短いラベル", "detail": "具体的な動向の説明(事実ベース、1〜2文)", "source_url": "情報源となった記事の実際のURL"}
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
- autonomous_driving.highlightsは2〜3件程度。技術・企業・法規制・事故/安全性など幅広い切り口から選ぶこと。
- source_urlは必ずWeb検索で実際に見つかった記事のURLをそのまま使うこと。推測やでっち上げのURLは絶対に使わないこと。該当する情報源が見つからない場合はsource_urlを空文字("")にすること。
- 内容は毎日変化をつけ、同じような内容の繰り返しを避けること。`;

async function generateContent() {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: PROMPT }],
  });

  const textBlocks = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const extracted = extractFirstJsonObject(textBlocks);
  if (!extracted) {
    console.error("--- Claude APIの生レスポンス ---");
    console.error(textBlocks);
    console.error("--------------------------------");
    throw new Error(
      "Claude APIの応答から完全なJSONオブジェクトを抽出できませんでした(出力が途中で切れている可能性があります)"
    );
  }

  try {
    return JSON.parse(extracted);
  } catch (err) {
    console.error("--- パースに失敗したJSON文字列 ---");
    console.error(extracted);
    console.error("--------------------------------");
    throw err;
  }
}

// 文字列の先頭の "{" から、対応する閉じ括弧までを波括弧の対応関係を
// 数えながら抽出する。文字列内の { } はカウントしないよう考慮する。
function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null; // 閉じ括弧まで到達しなかった = 出力が途中で切れている
}

// --- 2. HTML生成 -----------------------------------------------------

function renderHtml({ content, trashItems }) {
  const picksHtml = content.investment.picks
    .map(
      (p) => `
      <li>
        <strong>${escapeHtml(p.name)}</strong>（${escapeHtml(p.type)}）<br>
        <span class="reason">${escapeHtml(p.reason)}</span>
        ${p.source_url ? `<br><a class="source-link" href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener">情報源を見る →</a>` : ""}
      </li>`
    )
    .join("\n");

  const trashHtml = trashItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");

  const drivingHtml = content.autonomous_driving.highlights
    .map(
      (h) => `
      <li>
        <strong>${escapeHtml(h.topic)}</strong><br>
        <span class="reason">${escapeHtml(h.detail)}</span>
        ${h.source_url ? `<br><a class="source-link" href="${escapeHtml(h.source_url)}" target="_blank" rel="noopener">情報源を見る →</a>` : ""}
      </li>`
    )
    .join("\n");

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
  .source-link { color: #2563eb; font-size: 0.85rem; text-decoration: none; }
  .source-link:hover { text-decoration: underline; }
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
    <h2>🚗 自動運転技術トピック</h2>
    <p>${escapeHtml(content.autonomous_driving.summary)}</p>
    <ul>${drivingHtml}</ul>
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
