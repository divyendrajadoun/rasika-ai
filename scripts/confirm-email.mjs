// Confirm a sign-up by hand on the live site, for when the confirmation email doesn't arrive.
//   node scripts/confirm-email.mjs someone@example.com
// Shows the account's sign-up state, then marks its email confirmed so the person can sign in with
// the password they chose. Reads DATABASE_URL from .env.netlify (the site's own settings).
import fs from "node:fs";
import { createRequire } from "node:module";

const root = new URL("..", import.meta.url);
const postgres = createRequire(new URL("apps/web/package.json", root))("postgres");
const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("usage: node scripts/confirm-email.mjs <email>");
  process.exit(2);
}
const line = fs
  .readFileSync(new URL(".env.netlify", root), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is not in .env.netlify");
const sql = postgres(line.slice(13).replace(/^"|"$/g, ""), { max: 1, prepare: false });
try {
  const found = await sql`select id, created_at, confirmation_sent_at, email_confirmed_at
    from auth.users where lower(email) = lower(${email})`;
  if (found.length === 0) {
    console.log(
      `No sign-up for ${email}: the sign-up form didn't go through. Ask them to sign up again.`,
    );
  } else {
    const u = found[0];
    console.log(
      `${email}: signed up ${u.created_at?.toISOString()}, email sent ${u.confirmation_sent_at?.toISOString() ?? "never"}`,
    );
    if (u.email_confirmed_at) {
      console.log(
        `Already confirmed (${u.email_confirmed_at.toISOString()}): they can sign in now.`,
      );
    } else {
      await sql`update auth.users set email_confirmed_at = now() where id = ${u.id}`;
      console.log("Confirmed: they can sign in now with the password they chose.");
    }
  }
} finally {
  await sql.end();
}
