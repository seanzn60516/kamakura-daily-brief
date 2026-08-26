import nodemailer from "nodemailer";

const {
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  TO_EMAIL,
  PAGES_URL, // 例: https://your-username.github.io/kamakura-daily-brief/
} = process.env;

const missing = ["GMAIL_USER", "GMAIL_APP_PASSWORD", "TO_EMAIL", "PAGES_URL"].filter(
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
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: GMAIL_USER,
    to: TO_EMAIL,
    subject: `【デイリーブリーフ】${dateLabel}`,
    html: `
      <p>おはようございます。今日のブリーフができました。</p>
      <p><a href="${PAGES_URL}">${PAGES_URL}</a></p>
    `,
  });

  console.log("メール送信完了:", TO_EMAIL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
