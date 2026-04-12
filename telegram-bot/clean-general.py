"""
General Topic Cleaner
---------------------
Scans message IDs 1-500 in the group.
For each message that exists:
  - Forwards it to detect sender
  - If sender is the bot AND the message is in General (no thread_id), deletes it
  - Never deletes messages from real users
"""
import urllib.request, json, time, re

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
BOT_ID = 8729034252  # @monthlykey_bot

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}

def rate_safe(r):
    """Return retry-after seconds if rate limited, else 0."""
    desc = r.get("description", "")
    if "Too Many Requests" in desc:
        m = re.search(r"retry after (\d+)", desc)
        return int(m.group(1)) + 2 if m else 10
    return 0

def delete_msg(msg_id):
    r = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
    wait = rate_safe(r)
    if wait:
        print(f"    Rate limited on delete, waiting {wait}s...")
        time.sleep(wait)
        r = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
    return r.get("ok", False)

print("=" * 60)
print("GENERAL TOPIC CLEANER — Scanning IDs 1-500")
print("=" * 60)
print()

bot_messages_in_general = []
all_found = []

for msg_id in range(1, 501):
    # Step 1: Try to copy the message to detect if it exists
    r = api("copyMessage", {
        "chat_id": CHAT_ID,
        "from_chat_id": CHAT_ID,
        "message_id": msg_id,
        "disable_notification": True
    })

    desc = r.get("description", "")

    # Handle rate limit
    wait = rate_safe(r)
    if wait:
        print(f"  Rate limited at ID {msg_id}, waiting {wait}s...")
        time.sleep(wait)
        r = api("copyMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
        desc = r.get("description", "")

    if r.get("ok"):
        copy_id = r["result"]["message_id"]
        # Delete the copy immediately
        api("deleteMessage", {"chat_id": CHAT_ID, "message_id": copy_id})

        # Step 2: Forward to get sender info
        fwd = api("forwardMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })

        if fwd.get("ok"):
            fmsg = fwd["result"]
            fwd_id = fmsg["message_id"]
            thread = fmsg.get("message_thread_id")  # None = General

            # Get sender from forward_from or forward_origin
            fwd_from = fmsg.get("forward_from") or {}
            fwd_origin = fmsg.get("forward_origin") or {}
            sender_id = None
            sender_name = "unknown"

            if fwd_from:
                sender_id = fwd_from.get("id")
                sender_name = f"{fwd_from.get('first_name','')} {fwd_from.get('last_name','')}".strip()
                sender_username = fwd_from.get("username", "")
            elif fwd_origin.get("sender_user"):
                su = fwd_origin["sender_user"]
                sender_id = su.get("id")
                sender_name = f"{su.get('first_name','')} {su.get('last_name','')}".strip()
                sender_username = su.get("username", "")
            else:
                sender_name = fmsg.get("forward_sender_name", "protected/anonymous")
                sender_username = ""

            text = fmsg.get("text") or fmsg.get("caption") or "[media/service]"

            # Delete the forwarded copy
            api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})

            all_found.append({
                "id": msg_id,
                "thread": thread,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "text": text[:120]
            })

            # Check: is this a bot message in General (thread is None)?
            is_bot = (sender_id == BOT_ID)
            is_general = (thread is None)

            if is_bot and is_general:
                print(f"  🤖 BOT in GENERAL — ID:{msg_id} Text:{text[:80]}")
                bot_messages_in_general.append(msg_id)
            elif is_general:
                print(f"  👤 USER in GENERAL — ID:{msg_id} From:'{sender_name}' Text:{text[:60]}")
            else:
                # In a topic thread — not our concern
                pass

        else:
            # Can't forward (protected or service message) — check if it's in General
            # We can't determine sender, so skip to be safe
            thread_from_copy = r.get("result", {}).get("message_thread_id")
            if thread_from_copy is None:
                print(f"  [?] ID:{msg_id} in General but can't forward: {fwd.get('description','')}")

    elif "message to copy not found" in desc:
        pass  # Doesn't exist
    elif "can't be copied" in desc.lower():
        # Service message (e.g. "pinned message" notification) — these appear in General
        # Try to delete it if it's a service message from the bot's actions
        # We'll try forwarding to check
        fwd = api("forwardMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
        if fwd.get("ok"):
            fmsg = fwd["result"]
            fwd_id = fmsg["message_id"]
            thread = fmsg.get("message_thread_id")
            text = fmsg.get("text") or "[service message]"
            api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})
            if thread is None:
                print(f"  [SVC] ID:{msg_id} in General (service msg): {text[:60]}")
                # Service messages like "pinned a message" can be deleted
                bot_messages_in_general.append(msg_id)
        else:
            pass  # Can't determine, skip

    time.sleep(0.2)

    if msg_id % 100 == 0:
        print(f"\n  --- Progress: {msg_id}/500 | Found {len(bot_messages_in_general)} bot msgs in General ---\n")

print(f"\n{'='*60}")
print(f"SCAN COMPLETE: {len(all_found)} messages found total")
print(f"Bot messages in General: {len(bot_messages_in_general)}")
print(f"IDs to delete: {bot_messages_in_general}")
print(f"{'='*60}\n")

if not bot_messages_in_general:
    print("✅ No bot messages found in General topic. Nothing to delete.")
else:
    print(f"🗑️  Deleting {len(bot_messages_in_general)} bot messages from General...\n")
    deleted = 0
    failed = []
    for msg_id in bot_messages_in_general:
        ok = delete_msg(msg_id)
        if ok:
            print(f"  ✅ Deleted ID:{msg_id}")
            deleted += 1
        else:
            print(f"  ❌ Failed to delete ID:{msg_id}")
            failed.append(msg_id)
        time.sleep(0.5)

    print(f"\n{'='*60}")
    print(f"✅ Deleted: {deleted}/{len(bot_messages_in_general)}")
    if failed:
        print(f"❌ Failed: {failed}")
    print(f"{'='*60}")
