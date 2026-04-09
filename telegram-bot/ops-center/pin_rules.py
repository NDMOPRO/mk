#!/usr/bin/env python3
"""
Send and pin the full operating rules message in Topic 00.
Uses HTML parse mode to avoid MarkdownV2 escaping issues.
"""

import requests
import time

BOT_TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
TOPIC_00_ID = 3   # 00 — Rules & Channel Guide
API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"

def api(method, payload):
    resp = requests.post(f"{API_BASE}/{method}", json=payload, timeout=15)
    data = resp.json()
    if not data.get("ok"):
        print(f"  ERROR [{method}]: {data.get('description')}")
        return None
    return data["result"]

RULES_HTML = """<b>📋 MONTHLY KEY | DAILY OPERATIONS HQ</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🏢 GROUP PURPOSE</b>
This group is the central command center for daily execution, follow-up, reporting, and escalation across Monthly Key. It is part of the operating system of the company and must be used every day by leadership and department owners.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>⏰ REPORTING SCHEDULE (Saudi Arabia — UTC+3)</b>

🌅 <b>9:00 AM</b> — Morning priorities and execution plan
☀️ <b>2:00 PM</b> — Midday progress update and blocker review
🌙 <b>8:00 PM</b> — End-of-day report, completed work, and tomorrow plan

These times are the standard operating rhythm unless leadership changes them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📝 REQUIRED UPDATE FORMAT</b>
Every operational update must follow this exact structure:

<pre>Task:
Owner:
Priority:
Status: Done / In Progress / Blocked
Deadline:
Blocker:
Next step:</pre>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📌 TOPIC DIRECTORY</b>

00 — Rules &amp; Channel Guide
01 — Daily CEO Update
02 — Operations Follow-Up
03 — Listings &amp; Inventory
04 — Bookings &amp; Revenue
05 — Customer Support &amp; Complaints
06 — Website &amp; Tech Issues
07 — Payments &amp; Finance
08 — Marketing &amp; Content
09 — Legal / Compliance / Government
10 — Blockers &amp; Escalations
11 — Completed Today
12 — Tomorrow Priorities

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🚨 ESCALATION RULES</b>

• Critical blockers must be posted in <b>10 — Blockers &amp; Escalations</b> immediately
• Any issue that stops execution, threatens launch, or requires a founder decision goes to Topic 10
• Topic 10 must remain clean and high-signal — no casual updates
• All escalations must include: what is blocked, why, and what decision is needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🔇 COMMUNICATION DISCIPLINE</b>

• Post only in the correct topic — no mixed-topic updates
• No unstructured reporting or scattered follow-up
• Use the required update format for all operational messages
• No off-topic conversations in operational topics
• Every update must have a named owner
• Silence is not an update — if you have nothing to report, say so

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>✅ OWNER ACCOUNTABILITY</b>

• Every task must have one named owner
• Owners are responsible for updating their tasks at each reporting time
• If a task is blocked, the owner must escalate immediately — not wait for the next check-in
• Completed tasks must be logged in <b>11 — Completed Today</b>
• Tomorrow's priorities must be posted in <b>12 — Tomorrow Priorities</b> by 8 PM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>This group is not optional. It is the operating system of Monthly Key.</i>"""

def main():
    print("Sending formatted rules to Topic 00 — Rules & Channel Guide...")

    # First delete the old plain-text message (message_id=16)
    print("  Deleting old plain-text message (id=16)...", end=" ")
    del_result = api("deleteMessage", {
        "chat_id": CHAT_ID,
        "message_id": 16
    })
    if del_result is not None:
        print("OK")
    else:
        print("FAILED (may not exist, continuing)")

    time.sleep(1)

    # Send the HTML-formatted rules
    print("  Sending HTML rules message...", end=" ")
    msg = api("sendMessage", {
        "chat_id": CHAT_ID,
        "message_thread_id": TOPIC_00_ID,
        "text": RULES_HTML,
        "parse_mode": "HTML"
    })

    if not msg:
        print("FAILED")
        return

    msg_id = msg["message_id"]
    print(f"OK (message_id={msg_id})")

    # Pin the message
    print("  Pinning message...", end=" ")
    pinned = api("pinChatMessage", {
        "chat_id": CHAT_ID,
        "message_id": msg_id,
        "disable_notification": True
    })
    if pinned is not None:
        print("OK")
    else:
        print("FAILED")

    print(f"\n✅ Rules pinned successfully in Topic 00 (message_id={msg_id})")

if __name__ == "__main__":
    main()
