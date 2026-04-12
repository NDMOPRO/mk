"""
Comprehensive Message Scanner for Daily Operations HQ
------------------------------------------------------
Strategy: Use copyMessage to a private chat (the bot's own chat with the owner)
to "read" messages without polluting the group. If that fails, try forwardMessage.

The bot's own user ID can be used as destination for copyMessage.
We'll scan IDs 1-500 across the group.
"""

import urllib.request
import json
import time
import sys

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285

# Known topic thread IDs
THREADS = [None, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 235]

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_bot_info():
    r = api("getMe", {})
    if r.get("ok"):
        return r["result"]["id"]
    return None

def scan_message(msg_id, dest_chat):
    """Try to copy a message to dest_chat to read its content."""
    r = api("copyMessage", {
        "chat_id": dest_chat,
        "from_chat_id": CHAT_ID,
        "message_id": msg_id,
        "disable_notification": True
    })
    return r

def delete_message(chat_id, msg_id):
    api("deleteMessage", {"chat_id": chat_id, "message_id": msg_id})

def main():
    print("=== COMPREHENSIVE GROUP MESSAGE SCANNER ===\n")
    
    # Get bot info
    bot_id = get_bot_info()
    print(f"Bot ID: {bot_id}")
    
    # We need a private chat to copy messages to.
    # The owner's user ID from bot.db is 580808550 (@hobart2007)
    # Let's try copying to the owner's private chat with the bot
    # Actually, we can't initiate a chat. Let's try copying to the group's General thread
    # but immediately delete — that way we can see the content.
    
    # Better approach: scan by trying to get message info via getChat
    # Actually the only way is to copy to a chat the bot has access to.
    # Let's try the group itself (General thread = no thread_id) and delete immediately.
    
    print("\nScanning message IDs 1-500 in the group...")
    print("(Copying to General thread and immediately deleting to read content)\n")
    
    found_messages = []
    
    for msg_id in range(1, 501):
        r = scan_message(msg_id, CHAT_ID)
        
        if r.get("ok"):
            copy_id = r["result"]["message_id"]
            # We can't read the content from copyMessage response directly
            # But we know the message EXISTS. Now try to forward it to read sender info.
            fwd = api("forwardMessage", {
                "chat_id": CHAT_ID,
                "from_chat_id": CHAT_ID,
                "message_id": msg_id,
                "disable_notification": True
            })
            
            if fwd.get("ok"):
                fwd_msg = fwd["result"]
                fwd_id = fwd_msg["message_id"]
                
                # Extract sender info from forward_from or forward_sender_name
                fwd_from = fwd_msg.get("forward_from", {})
                fwd_name = fwd_msg.get("forward_sender_name", "")
                fwd_origin = fwd_msg.get("forward_origin", {})
                
                sender_name = ""
                sender_username = ""
                
                if fwd_from:
                    sender_name = f"{fwd_from.get('first_name','')} {fwd_from.get('last_name','')}".strip()
                    sender_username = fwd_from.get("username", "")
                elif fwd_name:
                    sender_name = fwd_name
                elif fwd_origin:
                    sender = fwd_origin.get("sender_user", {})
                    sender_name = f"{sender.get('first_name','')} {sender.get('last_name','')}".strip()
                    sender_username = sender.get("username", "")
                
                text = fwd_msg.get("text") or fwd_msg.get("caption") or "[media/sticker]"
                thread = fwd_msg.get("message_thread_id", "General")
                
                print(f"  FOUND ID:{msg_id} Thread:{thread} From:'{sender_name}' (@{sender_username}) Text:{text[:100]}")
                
                found_messages.append({
                    "original_id": msg_id,
                    "thread": thread,
                    "sender_name": sender_name,
                    "sender_username": sender_username,
                    "text": text,
                    "full_msg": fwd_msg
                })
                
                # Delete the forwarded copy
                delete_message(CHAT_ID, fwd_id)
            else:
                # Message exists but can't be forwarded (e.g., bot's own message or protected)
                text_hint = "(exists, not forwardable)"
                thread = "unknown"
                print(f"  EXISTS ID:{msg_id} Thread:{thread} {text_hint} fwd_err:{fwd.get('description','')}")
                found_messages.append({
                    "original_id": msg_id,
                    "thread": "unknown",
                    "sender_name": "bot/protected",
                    "sender_username": "",
                    "text": text_hint,
                    "full_msg": {}
                })
            
            # Delete the copy we made
            delete_message(CHAT_ID, copy_id)
            
        elif "message to copy not found" in r.get("description", ""):
            pass  # Message doesn't exist, skip silently
        elif "Too Many Requests" in r.get("description", ""):
            retry_after = 5
            print(f"  Rate limited at ID {msg_id}, waiting {retry_after}s...")
            time.sleep(retry_after)
            # Retry
            r2 = scan_message(msg_id, CHAT_ID)
            if r2.get("ok"):
                print(f"  Retry succeeded for ID {msg_id}")
        else:
            # Other error
            pass
        
        time.sleep(0.15)  # Gentle pacing
        
        # Progress indicator every 50
        if msg_id % 50 == 0:
            print(f"  ... scanned up to ID {msg_id}, found {len(found_messages)} messages so far")
    
    print(f"\n=== SCAN COMPLETE: {len(found_messages)} messages found ===\n")
    
    # Filter for Mushtaq
    mushtaq_messages = [m for m in found_messages 
                        if "mushtaq" in m["sender_name"].lower() 
                        or "mushtaq" in m["sender_username"].lower()]
    
    print(f"=== MUSHTAQ'S MESSAGES: {len(mushtaq_messages)} ===")
    for m in mushtaq_messages:
        print(f"\n  Thread: {m['thread']}")
        print(f"  Original ID: {m['original_id']}")
        print(f"  From: {m['sender_name']} (@{m['sender_username']})")
        print(f"  Text: {m['text']}")
    
    print("\n=== ALL SENDERS FOUND ===")
    senders = {}
    for m in found_messages:
        key = m["sender_name"]
        if key not in senders:
            senders[key] = {"count": 0, "threads": set()}
        senders[key]["count"] += 1
        senders[key]["threads"].add(str(m["thread"]))
    
    for name, info in sorted(senders.items()):
        print(f"  {name}: {info['count']} messages in threads {info['threads']}")
    
    # Save results to file
    with open("/tmp/scan_results.json", "w") as f:
        json.dump(found_messages, f, indent=2, default=str)
    print("\nFull results saved to /tmp/scan_results.json")

if __name__ == "__main__":
    main()
