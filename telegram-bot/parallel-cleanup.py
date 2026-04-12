import urllib.request, json, time, threading, queue, sys

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
PROTECTED_IDS = {384, 386, 388, 390, 392, 394, 396, 398, 400, 402, 404, 406, 408, 410, 412, 414, 928}

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=2) as r:
            return json.loads(r.read())
    except: return {"ok": False}

deleted_count = 0
lock = threading.Lock()

def worker(q):
    global deleted_count
    while not q.empty():
        msg_id = q.get()
        if msg_id in PROTECTED_IDS:
            q.task_done()
            continue
        
        # Fast delete probe
        r = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        if r.get("ok"):
            with lock:
                deleted_count += 1
                if deleted_count % 10 == 0:
                    print(f"  🗑️ Deleted: {deleted_count}", flush=True)
        
        # Minimal delay to avoid heavy rate limit
        time.sleep(0.05)
        q.task_done()

print(f"=== HIGH SPEED CLEANUP START (IDs 234-1100) ===", flush=True)
q = queue.Queue()
for i in range(234, 1101):
    q.put(i)

# Start 20 threads for parallel processing
threads = []
for i in range(20):
    t = threading.Thread(target=worker, args=(q,))
    t.start()
    threads.append(t)

q.join()
print(f"=== DONE: {deleted_count} additional messages deleted ===", flush=True)
