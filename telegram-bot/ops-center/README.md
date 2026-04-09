# Monthly Key | Daily Operations HQ — Telegram Bot

Automated reminder bot for the **Monthly Key | Daily Operations HQ** Telegram group.

## Overview

| Field | Value |
|-------|-------|
| **Bot** | @monthlykey_bot |
| **Group** | Monthly Key \| Daily Operations HQ |
| **Chat ID** | -1003967447285 |
| **Timezone** | Saudi Arabia (UTC+3 / KSA) |

## Scheduled Reminders

| Time (KSA) | Reminder |
|------------|----------|
| **9:00 AM** | Morning priorities and execution plan |
| **2:00 PM** | Midday progress update and blocker review |
| **8:00 PM** | End-of-day report, completed work, and tomorrow plan |

Reminders are posted to **Topic 01 — Daily CEO Update** to serve as the group-wide daily rhythm signal.

## Forum Topics

| Thread ID | Topic |
|-----------|-------|
| 3 | 00 — Rules & Channel Guide |
| 4 | 01 — Daily CEO Update |
| 5 | 02 — Operations Follow-Up |
| 6 | 03 — Listings & Inventory |
| 7 | 04 — Bookings & Revenue |
| 8 | 05 — Customer Support & Complaints |
| 9 | 06 — Website & Tech Issues |
| 10 | 07 — Payments & Finance |
| 11 | 08 — Marketing & Content |
| 12 | 09 — Legal / Compliance / Government |
| 13 | 10 — Blockers & Escalations |
| 14 | 11 — Completed Today |
| 15 | 12 — Tomorrow Priorities |

## Required Update Format

Every operational update posted in the group must follow this structure:

```
Task:
Owner:
Priority:
Status: Done / In Progress / Blocked
Deadline:
Blocker:
Next step:
```

## Files

| File | Purpose |
|------|---------|
| `bot.py` | Main scheduler bot — runs 24/7 sending reminders |
| `setup_topics.py` | One-time setup: creates all 13 forum topics |
| `pin_rules.py` | One-time setup: pins the operating rules in Topic 00 |
| `topic_ids.json` | Saved topic thread IDs |
| `requirements.txt` | Python dependencies |
| `monthlykey-bot.service` | systemd service file for production deployment |

## Running the Bot

### Development

```bash
pip install -r requirements.txt
python3 bot.py
```

### Production (systemd)

```bash
sudo cp monthlykey-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable monthlykey-bot
sudo systemctl start monthlykey-bot
sudo systemctl status monthlykey-bot
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_TOKEN` | (set in code) | Telegram Bot API token |
| `CHAT_ID` | -1003967447285 | Telegram supergroup chat ID |

## Deployment Notes

- The bot uses Python's built-in `sched` module — no external scheduler required
- Reminders auto-reschedule daily after firing
- All times are calculated in Saudi Arabia timezone (UTC+3)
- The bot will restart automatically via systemd if it crashes
