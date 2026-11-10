// Give an account reel credits on the live site, the same way /admin's "Give" button does (profile
// balance + a credit_ledger line), for when the admin page can't be reached.
//   node scripts/grant-credits.mjs someone@example.com 6
// Reads DATABASE_URL from .env.netlify (the site's own settings). The account must exist: the person
// signs up first.
import fs from "node:fs";
import { createRequire } from "node:module";

const root = new URL("..", import.meta.url);
const postgres = createRequire(new URL("apps/web/package.json", root))("postgres");
const [email, raw] = process.argv.slice(2);
const n = Math.trunc(Number(raw));
if (!email || !email.includes("@") || !n || Math.abs(n) > 1000) {
  console.error("usage: node scripts/grant-credits.mjs <email> <credits>");
  process.exit(2);
}
const line = fs
  .readFileSync(new URL(".env.netlify", root), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is not in .env.netlify");
const sql = postgres(line.slice(13).replace(/^"|"$/g, ""), { max: 1, prepare: false });
try {
  const found =
    await sql`select user_id, credits from profiles where lower(email) = lower(${email})`;
  if (found.length === 0) {
    console.log(
      `No account for ${email} yet: they need to sign up and sign in once, then run this again.`,
    );
  } else {
    const { user_id: userId, credits } = found[0];
    const [after] = await sql.begin(async (tx) => {
      const rows =
        await tx`update profiles set credits = greatest(0, credits + ${n}), updated_at = now()
        where user_id = ${userId} returning credits`;
      await tx`insert into credit_ledger (user_id, delta, reason) values (${userId}, ${n}, 'admin:script')`;
      return rows;
    });
    console.log(`${email}: ${credits} -> ${after.credits} credits`);
  }
} finally {
  await sql.end();
}
