"""Emails from the worker: "your reel is ready", sent over SMTP (the Brevo account the website and
Supabase use). Without SMTP settings nothing is sent, and a failure never touches the job."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

import structlog

from rasika_worker.settings import Settings

log = structlog.get_logger()


def send(s: Settings, to: str, subject: str, text: str) -> bool:
    if not (s.smtp_host and s.smtp_user and s.smtp_pass and s.smtp_from and to):
        return False
    msg = EmailMessage()
    msg["From"] = s.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    try:
        if s.smtp_port == 465:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15) as c:
                c.login(s.smtp_user, s.smtp_pass)
                c.send_message(msg)
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as c:
                c.starttls(context=ssl.create_default_context())
                c.login(s.smtp_user, s.smtp_pass)
                c.send_message(msg)
        return True
    except Exception as exc:  # never fail a render over an email
        log.warning("email_failed", to=to, error=str(exc))
        return False


def reel_ready(s: Settings, to: str, title: str, project_id: str) -> bool:
    link = f"{s.site_url.rstrip('/')}/dashboard/p/{project_id}"
    return send(
        s,
        to,
        f"Your reel is ready: {title}",
        f"Your Rasika reel “{title}” has finished rendering.\n\n"
        f"Watch it, edit it or download it here:\n{link}\n\n"
        "Rasika",
    )
