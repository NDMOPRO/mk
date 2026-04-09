#!/usr/bin/env python3
"""
Monthly Key | Daily Operations HQ — Topic Setup Script
Creates all 13 required forum topics and pins the rules in Topic 00.
"""

import requests
import json
import time
import sys

BOT_TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Topic colours (Telegram icon_color values)
COLORS = {
    "red":    16478047,  # #FB6F3F
    "orange": 16766590,  # #FFD67E
    "green":  8311585,   # #7EE2B8 — teal/green
    "blue":   7322096,   # #6FB9F0
    "purple": 13338331,  # #CB86DB
    "pink":   16749490,  # #FF93B2
    "yellow": 16766590,  # #FFD67E
}

# 13 topics: (name, icon_color)
TOPICS = [
    ("00 — Rules & Channel Guide",          COLORS["blue"]),
    ("01 — Daily CEO Update",               COLORS["red"]),
    ("02 — Operations Follow-Up",           COLORS["orange"]),
    ("03 — Listings & Inventory",           COLORS["green"]),
    ("04 — Bookings & Revenue",             COLORS["green"]),
    ("05 — Customer Support & Complaints",  COLORS["pink"]),
    ("06 — Website & Tech Issues",          COLORS["purple"]),
    ("07 — Payments & Finance",             COLORS["orange"]),
    ("08 — Marketing & Content",            COLORS["pink"]),
    ("09 — Legal / Compliance / Government",COLORS["red"]),
    ("10 — Blockers & Escalations",         COLORS["red"]),
    ("11 — Completed Today",                COLORS["green"]),
    ("12 — Tomorrow Priorities",            COLORS["blue"]),
]

def api(method, payload=None, retries=3):
    url = f"{API_BASE}/{method}"
    for attempt in range(retries):
        try:
            resp = requests.post(url, json=payload, timeout=15) if payload else requests.get(url, timeout=15)
            data = resp.json()
            if data.get("ok"):
                return data["result"]
            else:
                print(f"  [API ERROR] {method}: {data.get('description')} (attempt {attempt+1})")
                if attempt < retries - 1:
                    time.sleep(2)
        except Exception as e:
            print(f"  [EXCEPTION] {method}: {e} (attempt {attempt+1})")
            if attempt < retries - 1:
                time.sleep(2)
    return None

def create_topics():
    print("=" * 60)
    print("Creating 13 Forum Topics")
    print("=" * 60)
    topic_ids = {}
    for name, color in TOPICS:
        print(f"  Creating: {name} ...", end=" ", flush=True)
        result = api("createForumTopic", {
            "chat_id": CHAT_ID,
            "name": name,
            "icon_color": color
        })
        if result:
            tid = result["message_thread_id"]
            topic_ids[name] = tid
            print(f"OK (thread_id={tid})")
        else:
            print("FAILED")
        time.sleep(0.8)  # avoid rate limiting
    return topic_ids

def pin_rules(topic_id):
    print("\n" + "=" * 60)
    print("Pinning Rules in Topic 00 — Rules & Channel Guide")
    print("=" * 60)

    rules_text = (
        "📋 *MONTHLY KEY | DAILY OPERATIONS HQ*\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🏢 *GROUP PURPOSE*\n"
        "This group is the central command center for daily execution, follow\\-up, reporting, and escalation across Monthly Key\\. "
        "It is part of the operating system of the company and must be used every day by leadership and department owners\\.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "⏰ *REPORTING SCHEDULE \\(Saudi Arabia — UTC\\+3\\)*\n\n"
        "🌅 *9:00 AM* — Morning priorities and execution plan\n"
        "☀️ *2:00 PM* — Midday progress update and blocker review\n"
        "🌙 *8:00 PM* — End\\-of\\-day report, completed work, and tomorrow plan\n\n"
        "These times are the standard operating rhythm unless leadership changes them\\.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "📝 *REQUIRED UPDATE FORMAT*\n"
        "Every operational update must follow this exact structure:\n\n"
        "```\n"
        "Task:\n"
        "Owner:\n"
        "Priority:\n"
        "Status: Done / In Progress / Blocked\n"
        "Deadline:\n"
        "Blocker:\n"
        "Next step:\n"
        "```\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "📌 *TOPIC DIRECTORY*\n\n"
        "00 — Rules & Channel Guide\n"
        "01 — Daily CEO Update\n"
        "02 — Operations Follow\\-Up\n"
        "03 — Listings & Inventory\n"
        "04 — Bookings & Revenue\n"
        "05 — Customer Support & Complaints\n"
        "06 — Website & Tech Issues\n"
        "07 — Payments & Finance\n"
        "08 — Marketing & Content\n"
        "09 — Legal / Compliance / Government\n"
        "10 — Blockers & Escalations\n"
        "11 — Completed Today\n"
        "12 — Tomorrow Priorities\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🚨 *ESCALATION RULES*\n\n"
        "• Critical blockers must be posted in *10 — Blockers & Escalations* immediately\n"
        "• Any issue that stops execution, threatens launch, or requires a founder decision goes to Topic 10\n"
        "• Topic 10 must remain clean and high\\-signal — no casual updates\n"
        "• All escalations must include: what is blocked, why, and what decision is needed\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🔇 *COMMUNICATION DISCIPLINE*\n\n"
        "• Post only in the correct topic — no mixed\\-topic updates\n"
        "• No unstructured reporting or scattered follow\\-up\n"
        "• Use the required update format for all operational messages\n"
        "• No off\\-topic conversations in operational topics\n"
        "• Every update must have a named owner\n"
        "• Silence is not an update — if you have nothing to report, say so\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "✅ *OWNER ACCOUNTABILITY*\n\n"
        "• Every task must have one named owner\n"
        "• Owners are responsible for updating their tasks at each reporting time\n"
        "• If a task is blocked, the owner must escalate immediately — not wait for the next check\\-in\n"
        "• Completed tasks must be logged in *11 — Completed Today*\n"
        "• Tomorrow's priorities must be posted in *12 — Tomorrow Priorities* by 8 PM\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "_This group is not optional\\. It is the operating system of Monthly Key\\._"
    )

    print("  Sending rules message ...", end=" ", flush=True)
    msg = api("sendMessage", {
        "chat_id": CHAT_ID,
        "message_thread_id": topic_id,
        "text": rules_text,
        "parse_mode": "MarkdownV2"
    })
    if not msg:
        print("FAILED — trying plain text fallback")
        msg = api("sendMessage", {
            "chat_id": CHAT_ID,
            "message_thread_id": topic_id,
            "text": build_plain_rules()
        })

    if msg:
        msg_id = msg["message_id"]
        print(f"OK (message_id={msg_id})")
        # Pin the message
        print("  Pinning message ...", end=" ", flush=True)
        pinned = api("pinChatMessage", {
            "chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
        if pinned is not None:
            print("OK")
        else:
            print("FAILED")
        return msg_id
    else:
        print("FAILED")
        return None

def build_plain_rules():
    return """📋 MONTHLY KEY | DAILY OPERATIONS HQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 GROUP PURPOSE
This group is the central command center for daily execution, follow-up, reporting, and escalation across Monthly Key. It is part of the operating system of the company and must be used every day by leadership and department owners.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ REPORTING SCHEDULE (Saudi Arabia — UTC+3)

🌅 9:00 AM — Morning priorities and execution plan
☀️ 2:00 PM — Midday progress update and blocker review
🌙 8:00 PM — End-of-day report, completed work, and tomorrow plan

These times are the standard operating rhythm unless leadership changes them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 REQUIRED UPDATE FORMAT
Every operational update must follow this exact structure:

Task:
Owner:
Priority:
Status: Done / In Progress / Blocked
Deadline:
Blocker:
Next step:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 TOPIC DIRECTORY

00 — Rules & Channel Guide
01 — Daily CEO Update
02 — Operations Follow-Up
03 — Listings & Inventory
04 — Bookings & Revenue
05 — Customer Support & Complaints
06 — Website & Tech Issues
07 — Payments & Finance
08 — Marketing & Content
09 — Legal / Compliance / Government
10 — Blockers & Escalations
11 — Completed Today
12 — Tomorrow Priorities

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 ESCALATION RULES

• Critical blockers must be posted in 10 — Blockers & Escalations immediately
• Any issue that stops execution, threatens launch, or requires a founder decision goes to Topic 10
• Topic 10 must remain clean and high-signal — no casual updates
• All escalations must include: what is blocked, why, and what decision is needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔇 COMMUNICATION DISCIPLINE

• Post only in the correct topic — no mixed-topic updates
• No unstructured reporting or scattered follow-up
• Use the required update format for all operational messages
• No off-topic conversations in operational topics
• Every update must have a named owner
• Silence is not an update — if you have nothing to report, say so

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ OWNER ACCOUNTABILITY

• Every task must have one named owner
• Owners are responsible for updating their tasks at each reporting time
• If a task is blocked, the owner must escalate immediately — not wait for the next check-in
• Completed tasks must be logged in 11 — Completed Today
• Tomorrow's priorities must be posted in 12 — Tomorrow Priorities by 8 PM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This group is not optional. It is the operating system of Monthly Key."""

def send_welcome(topic_ids):
    """Send a welcome/activation message to each topic."""
    print("\n" + "=" * 60)
    print("Sending activation messages to all topics")
    print("=" * 60)

    topic_descriptions = {
        "01 — Daily CEO Update":
            "📌 This topic is used by leadership to publish:\n• Top priorities for the day\n• Critical decisions\n• Urgent business direction\n• Non-negotiable deliverables",
        "02 — Operations Follow-Up":
            "📌 This topic is used for field and execution work:\n• Apartment readiness\n• Housekeeping & maintenance\n• Furnishing and appliance status\n• Check-in readiness & operational delays",
        "03 — Listings & Inventory":
            "📌 This topic tracks:\n• New units to be listed\n• Listing edits & pricing changes\n• Missing photos or details\n• Furnished/unfurnished readiness",
        "04 — Bookings & Revenue":
            "📌 This topic reports:\n• New & pending bookings\n• Payment completion & failures\n• Upcoming move-ins and move-outs\n• Daily revenue follow-up",
        "05 — Customer Support & Complaints":
            "📌 This topic handles:\n• Tenant complaints & landlord issues\n• Urgent service requests\n• Refund cases & support escalations\n• Unresolved customer problems",
        "06 — Website & Tech Issues":
            "📌 This topic tracks:\n• Bugs & page failures\n• Broken forms & login issues\n• Mobile responsiveness issues\n• Deployment & integration failures",
        "07 — Payments & Finance":
            "📌 This topic covers:\n• Transaction failures & reconciliation\n• Payout tracking & refunds\n• Payment gateway follow-up\n• Finance-related blockers",
        "08 — Marketing & Content":
            "📌 This topic manages:\n• Ad campaigns & social media content\n• Offer launches & landing page readiness\n• WhatsApp campaigns & creative approvals\n• Campaign reporting",
        "09 — Legal / Compliance / Government":
            "📌 This topic handles:\n• Contract follow-up & compliance\n• Shomoos requirements\n• Business registration & licence tasks\n• Government-related dependencies",
        "10 — Blockers & Escalations":
            "🚨 RESERVED FOR CRITICAL ISSUES ONLY\n\nPost here when:\n• Execution is stopped\n• Launch or operations are threatened\n• A founder/leadership decision is required\n• Legal, technical, financial, or operational risk exists\n\nThis topic must remain clean and high-signal.",
        "11 — Completed Today":
            "✅ This topic logs:\n• Completed tasks & closed tickets\n• Resolved blockers\n• Measurable progress achieved today",
        "12 — Tomorrow Priorities":
            "📅 This topic defines (posted by 8 PM daily):\n• Next-day top priorities\n• Pending carry-forward items\n• Responsible owners\n• Planned execution order",
    }

    for name, tid in topic_ids.items():
        if name == "00 — Rules & Channel Guide":
            continue  # already handled
        desc = topic_descriptions.get(name, f"📌 Topic: {name}")
        print(f"  Activating: {name} ...", end=" ", flush=True)
        result = api("sendMessage", {
            "chat_id": CHAT_ID,
            "message_thread_id": tid,
            "text": f"*{name}*\n\n{desc}",
            "parse_mode": "Markdown"
        })
        if result:
            print(f"OK (msg_id={result['message_id']})")
        else:
            print("FAILED")
        time.sleep(0.6)

def main():
    print("\n🚀 Monthly Key | Daily Operations HQ — Setup Starting\n")

    # Step 1: Create all 13 topics
    topic_ids = create_topics()

    if not topic_ids:
        print("ERROR: No topics were created. Aborting.")
        sys.exit(1)

    print(f"\n✅ Created {len(topic_ids)} topics")

    # Save topic IDs for reference
    with open("/home/ubuntu/telegram-bot/topic_ids.json", "w") as f:
        json.dump(topic_ids, f, indent=2, ensure_ascii=False)
    print("  Topic IDs saved to topic_ids.json")

    # Step 2: Pin rules in Topic 00
    topic_00_id = topic_ids.get("00 — Rules & Channel Guide")
    if topic_00_id:
        pin_rules(topic_00_id)
    else:
        print("WARNING: Topic 00 not found, skipping rules pin")

    # Step 3: Send activation messages to all other topics
    send_welcome(topic_ids)

    print("\n" + "=" * 60)
    print("✅ SETUP COMPLETE")
    print("=" * 60)
    print(f"Group: Monthly Key | Daily Operations HQ")
    print(f"Chat ID: {CHAT_ID}")
    print(f"Topics created: {len(topic_ids)}")
    print("\nTopic IDs:")
    for name, tid in topic_ids.items():
        print(f"  [{tid}] {name}")

if __name__ == "__main__":
    main()
