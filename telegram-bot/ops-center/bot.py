#!/usr/bin/env python3
"""
Monthly Key | Daily Operations HQ — Scheduled Reminder Bot
Sends automated reminders at 9 AM, 2 PM, and 8 PM (Saudi Arabia UTC+3).

Topics:
  Thread 3  — 00 Rules & Channel Guide
  Thread 4  — 01 Daily CEO Update
  Thread 5  — 02 Operations Follow-Up
  Thread 6  — 03 Listings & Inventory
  Thread 7  — 04 Bookings & Revenue
  Thread 8  — 05 Customer Support & Complaints
  Thread 9  — 06 Website & Tech Issues
  Thread 10 — 07 Payments & Finance
  Thread 11 — 08 Marketing & Content
  Thread 12 — 09 Legal / Compliance / Government
  Thread 13 — 10 Blockers & Escalations
  Thread 14 — 11 Completed Today
  Thread 15 — 12 Tomorrow Priorities
"""

import os
import time
import logging
import requests
from datetime import datetime, timezone, timedelta

# ── Configuration ────────────────────────────────────────────────────────────
BOT_TOKEN = os.environ.get(
    "BOT_TOKEN",
    "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
)
CHAT_ID   = int(os.environ.get("CHAT_ID", "-1003967447285"))
API_BASE  = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Saudi Arabia timezone (UTC+3)
KSA_TZ = timezone(timedelta(hours=3))

# Topic thread IDs
TOPICS = {
    "rules":       3,
    "ceo":         4,
    "operations":  5,
    "listings":    6,
    "bookings":    7,
    "support":     8,
    "tech":        9,
    "finance":     10,
    "marketing":   11,
    "legal":       12,
    "blockers":    13,
    "completed":   14,
    "tomorrow":    15,
}

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("monthlykey-bot")

# ── Telegram API helper ───────────────────────────────────────────────────────
def send_message(thread_id: int, text: str, parse_mode: str = "HTML") -> bool:
    """Send a message to a specific forum topic thread."""
    payload = {
        "chat_id": CHAT_ID,
        "message_thread_id": thread_id,
        "text": text,
        "parse_mode": parse_mode,
    }
    for attempt in range(3):
        try:
            resp = requests.post(f"{API_BASE}/sendMessage", json=payload, timeout=15)
            data = resp.json()
            if data.get("ok"):
                return True
            log.warning(f"API error (attempt {attempt+1}): {data.get('description')}")
        except Exception as e:
            log.warning(f"Request error (attempt {attempt+1}): {e}")
        time.sleep(2)
    return False

# ── Reminder messages ─────────────────────────────────────────────────────────

MORNING_REMINDER = """🌅 <b>GOOD MORNING — 9:00 AM CHECK-IN</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

It's time for the <b>morning priorities and execution plan</b>.

Each department owner must post their update now using the required format:

<pre>Task:
Owner:
Priority:
Status: Done / In Progress / Blocked
Deadline:
Blocker:
Next step:</pre>

📌 Post in the correct topic for your area.
🚨 Any blockers? Escalate immediately to <b>10 — Blockers &amp; Escalations</b>.

Let's execute. 💪"""

MIDDAY_REMINDER = """☀️ <b>MIDDAY CHECK-IN — 2:00 PM UPDATE</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Time for the <b>midday progress update and blocker review</b>.

Each department owner must post a status update now:

<pre>Task:
Owner:
Priority:
Status: Done / In Progress / Blocked
Deadline:
Blocker:
Next step:</pre>

📌 Update your tasks in the correct topic.
🚨 New blockers? Post immediately in <b>10 — Blockers &amp; Escalations</b>.
✅ Completed tasks? Log them in <b>11 — Completed Today</b>.

Half the day is done — push through. 🔥"""

EVENING_REMINDER = """🌙 <b>END OF DAY — 8:00 PM REPORT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Time for the <b>end-of-day report, completed work, and tomorrow plan</b>.

<b>Step 1:</b> Log all completed work in <b>11 — Completed Today</b>

<b>Step 2:</b> Post your end-of-day update in your topic:

<pre>Task:
Owner:
Priority:
Status: Done / In Progress / Blocked
Deadline:
Blocker:
Next step:</pre>

<b>Step 3:</b> Post tomorrow's priorities in <b>12 — Tomorrow Priorities</b>:

<pre>Priority 1:
Priority 2:
Priority 3:
Owner:
Notes:</pre>

🚨 Any unresolved blockers? Escalate to <b>10 — Blockers &amp; Escalations</b> before end of day.

Good work today. Prepare for tomorrow. 🎯"""

# ── Scheduler ─────────────────────────────────────────────────────────────────

# (hour, minute) in KSA time → (thread_id, message)
SCHEDULE = [
    (9,  0,  TOPICS["ceo"],       MORNING_REMINDER),
    (14, 0,  TOPICS["ceo"],       MIDDAY_REMINDER),
    (20, 0,  TOPICS["ceo"],       EVENING_REMINDER),
]

def now_ksa() -> datetime:
    return datetime.now(KSA_TZ)

def seconds_until(hour: int, minute: int) -> float:
    """Return seconds until the next occurrence of hour:minute KSA."""
    n = now_ksa()
    target = n.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= n:
        target += timedelta(days=1)
    return (target - n).total_seconds()

def run_scheduler():
    log.info("Monthly Key Bot started — Saudi Arabia timezone (UTC+3)")
    log.info(f"Current KSA time: {now_ksa().strftime('%Y-%m-%d %H:%M:%S %Z')}")
    log.info("Scheduled reminders: 09:00, 14:00, 20:00 KSA")

    import sched, threading

    scheduler = sched.scheduler(time.time, time.sleep)

    def schedule_next(hour, minute, thread_id, message):
        delay = seconds_until(hour, minute)
        log.info(f"Next {hour:02d}:{minute:02d} reminder in {delay/3600:.2f} hours")
        scheduler.enter(delay, 1, fire_reminder, (hour, minute, thread_id, message))

    def fire_reminder(hour, minute, thread_id, message):
        ksa_now = now_ksa().strftime("%Y-%m-%d %H:%M:%S KSA")
        log.info(f"Firing {hour:02d}:{minute:02d} reminder at {ksa_now}")
        ok = send_message(thread_id, message)
        if ok:
            log.info(f"Reminder sent successfully to thread {thread_id}")
        else:
            log.error(f"Failed to send reminder to thread {thread_id}")
        # Reschedule for next day
        schedule_next(hour, minute, thread_id, message)

    # Schedule all reminders
    for hour, minute, thread_id, message in SCHEDULE:
        schedule_next(hour, minute, thread_id, message)

    log.info("Scheduler running — waiting for reminder times...")
    scheduler.run()

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run_scheduler()
