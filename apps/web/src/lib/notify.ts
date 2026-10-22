import "server-only";
import nodemailer from "nodemailer";

/**
 * Plain emails from the site (a new sign-up, a payment to confirm, credits added) over SMTP, e.g.
 * the Brevo account that also sends Supabase's login emails. Without SMTP_* nothing is sent, and a
 * failure never breaks the page that triggered it.
 */
function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function sendMail(
  to: string | string[],
  subject: string,
  text: string,
): Promise<void> {
  const t = transport();
  const from = process.env.SMTP_FROM;
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!t || !from || list.length === 0) return;
  try {
    await Promise.race([
      t.sendMail({ from, to: list.join(", "), subject, text }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("smtp timeout")), 8000)),
    ]);
  } catch (e) {
    console.warn("[notify] mail failed:", e instanceof Error ? e.message : e);
  }
}

/** an email to the admins (ADMIN_EMAILS) */
export const notifyAdmins = (subject: string, text: string) =>
  sendMail(adminEmails(), subject, text);
