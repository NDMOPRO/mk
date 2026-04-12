import re

def patch_file(filepath, replacements):
    with open(filepath) as f:
        content = f.read()
    
    count = 0
    for pattern, replacement in replacements:
        matches = len(re.findall(pattern, content))
        if matches > 0:
            content = re.sub(pattern, replacement, content)
            count += matches
            print(f"  {filepath}: Fixed {matches}x: {pattern[:40]}...")
    
    with open(filepath, 'w') as f:
        f.write(content)
    return count

# Fix index.js (Error handlers and passive text replies)
# ctx.reply(t(lang, "error")) -> ctx.reply(t(lang, "error"), { message_thread_id: ctx.message?.message_thread_id || undefined })
# ctx.reply(searchingMsg, ...) -> ctx.reply(searchingMsg, { message_thread_id: ctx.message?.message_thread_id || undefined, ... })
patch_file("/home/ubuntu/mk/telegram-bot/src/index.js", [
    (r'await ctx\.reply\(t\(lang, "error"\)\);', 
     'await ctx.reply(t(lang, "error"), { message_thread_id: ctx.message?.message_thread_id || undefined });'),
    (r'return ctx\.reply\(appMsg, { \.\.\.appBtn }\);', 
     'return ctx.reply(appMsg, { ...appBtn, message_thread_id: ctx.message?.message_thread_id || undefined });'),
    (r'return ctx\.reply\(webMsg, { \.\.\.webBtn }\);', 
     'return ctx.reply(webMsg, { ...webBtn, message_thread_id: ctx.message?.message_thread_id || undefined });'),
])

# Fix ops-v4.js (Security notice and new member welcome)
# { parse_mode: "Markdown", message_thread_id: ctx.message?.message_thread_id || null } -> fallback to THREAD_CEO_UPDATE
patch_file("/home/ubuntu/mk/telegram-bot/src/handlers/ops-v4.js", [
    (r'message_thread_id: ctx\.message\?\.message_thread_id \|\| null', 
     'message_thread_id: ctx.message?.message_thread_id || 4'), # 4 is THREAD_CEO_UPDATE
    (r'message_thread_id: threadId', 
     'message_thread_id: threadId || 4'),
])

# Fix ops-admin.js (Stale schedule label)
patch_file("/home/ubuntu/mk/telegram-bot/src/handlers/ops-admin.js", [
    (r'schedule: "6:00 PM KSA daily → General"', 
     'schedule: "6:00 PM KSA daily → CEO Update"'),
])

print("\nFinal thread_id patches complete.")
