const {
  RESEND_API_KEY,
  TO_EMAIL,
  PAGES_URL, // 例: https://your-username.github.io/kamakura-daily-brief/
} = process.env;

const missing = ["RESEND_API_KEY", "TO_EMAIL", "PAGES_URL"].filter(
  (key) => !process.env[key]
);
if (missing.length > 0) {
  console.error("環境変数が不足しています:", missing.join(", "));
  process.exit(1);
}

const dateLabel = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());

async function main() {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // 独自ドメインを未設定の場合は resend.dev の共有アドレスを使用
      from: "Daily Brief <onboarding@resend.dev>",
      to: [TO_EMAIL],
      subject: `【デイリーブリーフ】${dateLabel}`,
      html: `
        <p>おはようございます。今日のブリーフができました。</p>
        <p><a href="${PAGES_URL}">${PAGES_URL}</a></p>
      `,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend APIエラー (${response.status}): ${errText}`);
  }

  console.log("メール送信完了:", TO_EMAIL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
