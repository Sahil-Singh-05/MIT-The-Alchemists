import email
import email.policy
from email.utils import parsedate_to_datetime
from pathlib import Path
from datetime import datetime
from html.parser import HTMLParser


class _HTMLStripper(HTMLParser):
    """Minimal HTML → plain text stripper."""
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def get_text(self):
        return " ".join(self.parts)


def _strip_html(html: str) -> str:
    stripper = _HTMLStripper()
    stripper.feed(html)
    return stripper.get_text()


def _extract_body(msg) -> str:
    """Walk MIME parts and return the best plain-text body."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                continue
            if ct == "text/plain":
                body = part.get_content()
                break
            elif ct == "text/html" and not body:
                body = _strip_html(part.get_content())
    else:
        ct = msg.get_content_type()
        if ct == "text/plain":
            body = msg.get_content()
        elif ct == "text/html":
            body = _strip_html(msg.get_content())
    return body.strip()


def _parse_date(msg) -> str:
    """Extract date from email headers; fall back to today."""
    date_str = msg.get("Date")
    if date_str:
        try:
            return parsedate_to_datetime(date_str).strftime("%Y-%m-%d")
        except Exception:
            pass
    return datetime.today().strftime("%Y-%m-%d")


def parse_eml(file_path: str) -> list[dict]:
    """
    Parse a single .eml file.
    Returns a list with one chunk dict containing:
      - text    : formatted email content (headers + body)
      - source  : filename
      - subject : email subject
      - sender  : From field
      - date    : email date (YYYY-MM-DD)
      - type    : 'email'
      - format  : 'email'
    """
    path = Path(file_path)

    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=email.policy.default)

    subject = msg.get("Subject", "(no subject)")
    sender  = msg.get("From",    "(unknown sender)")
    to      = msg.get("To",      "")
    date    = _parse_date(msg)
    body    = _extract_body(msg)

    # Format as a readable prose block so the LLM has full context
    text = (
        f"Email from {sender} to {to}.\n"
        f"Subject: {subject}\n"
        f"Date: {date}\n\n"
        f"{body}"
    )

    return [{
        "text"   : text,
        "source" : path.name,
        "subject": subject,
        "sender" : sender,
        "date"   : date,
        "type"   : "email",
        "format" : "email",
    }]


def parse_eml_folder(folder_path: str) -> list[dict]:
    """Parse all .eml files in a folder, sorted by date (oldest first)."""
    folder = Path(folder_path)
    all_chunks = []
    for eml_file in sorted(folder.glob("*.eml")):
        all_chunks.extend(parse_eml(str(eml_file)))
    # Sort by date so thread order is preserved for conflict detection
    all_chunks.sort(key=lambda c: c["date"])
    return all_chunks