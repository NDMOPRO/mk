import urllib.request, json, time

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
THREAD_MARKETING = 11

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}

def find_duplicates():
    print("Scanning for duplicate CEO task messages in Marketing topic...")
    # We know 929 is one of them. Scan around it.
    found_ids = []
    for msg_id in range(920, 950):
        # Forward to check sender and content
        fwd = api("forwardMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
        
        if fwd.get("ok"):
            fmsg = fwd["result"]
            fwd_id = fmsg["message_id"]
            text = fmsg.get("text") or ""
            sender_id = fmsg.get("forward_from", {}).get("id") or fmsg.get("forward_origin", {}).get("sender_user", {}).get("id")
            
            # Delete the forwarded copy
            api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})
            
            if "CEO TASK ASSIGNMENT" in text and "MKT-2026-001" in text:
                print(f"  Found CEO task at ID: {msg_id}")
                found_ids.append(msg_id)
        
        time.sleep(0.1)
    
    return found_ids

def main():
    ids = find_duplicates()
    if len(ids) > 1:
        # Keep the first one, delete the rest
        to_delete = ids[1:]
        print(f"Deleting duplicates: {to_delete}")
        for msg_id in to_delete:
            res = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
            if res.get("ok"):
                print(f"  ✅ Deleted ID: {msg_id}")
            else:
                print(f"  ❌ Failed to delete ID: {msg_id}")
    elif len(ids) == 1:
        print("Only one message found. No duplicates to delete.")
    else:
        print("No CEO task messages found in the scanned range.")

if __name__ == "__main__":
    main()
