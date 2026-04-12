"""
Fix ALL sendOpts patterns in ops-scheduler.js:
The pattern `if (x.thread_id) sendOpts.message_thread_id = x.thread_id;`
means if thread_id is null/undefined, the message goes to General.

FIX: Always set a fallback thread_id (THREAD_CEO_UPDATE = 4) so messages
NEVER go to General. If the task/record has a thread_id, use it; otherwise
fall back to CEO Update topic.
"""
import re

SCHEDULER = "/home/ubuntu/mk/telegram-bot/src/services/ops-scheduler.js"

with open(SCHEDULER) as f:
    content = f.read()

original = content

# Pattern 1: `if (v.thread_id) sendOpts.message_thread_id = v.thread_id;`
# Replace with: `sendOpts.message_thread_id = v.thread_id || THREAD_CEO_UPDATE;`
# Match all variations: v.thread_id, task.thread_id, fu.thread_id, r.thread_id, rec.thread_id, mention.thread_id
patterns = [
    (r'if \(v\.thread_id\) sendOpts\.message_thread_id = v\.thread_id;',
     'sendOpts.message_thread_id = v.thread_id || THREAD_CEO_UPDATE;'),
    (r'if \(task\.thread_id\) sendOpts\.message_thread_id = task\.thread_id;',
     'sendOpts.message_thread_id = task.thread_id || THREAD_CEO_UPDATE;'),
    (r'if \(fu\.thread_id\) sendOpts\.message_thread_id = fu\.thread_id;',
     'sendOpts.message_thread_id = fu.thread_id || THREAD_CEO_UPDATE;'),
    (r'if \(r\.thread_id\) sendOpts\.message_thread_id = r\.thread_id;',
     'sendOpts.message_thread_id = r.thread_id || THREAD_CEO_UPDATE;'),
    (r'if \(rec\.thread_id\) sendOpts\.message_thread_id = rec\.thread_id;',
     'sendOpts.message_thread_id = rec.thread_id || THREAD_CEO_UPDATE;'),
    (r'if \(mention\.thread_id\) sendOpts\.message_thread_id = mention\.thread_id;',
     'sendOpts.message_thread_id = mention.thread_id || THREAD_CEO_UPDATE;'),
]

count = 0
for pattern, replacement in patterns:
    matches = len(re.findall(pattern, content))
    if matches > 0:
        content = re.sub(pattern, replacement, content)
        count += matches
        print(f"  Fixed {matches}x: {pattern[:60]}...")

with open(SCHEDULER, 'w') as f:
    f.write(content)

print(f"\nTotal fixes in ops-scheduler.js: {count}")
print(f"File saved: {SCHEDULER}")
