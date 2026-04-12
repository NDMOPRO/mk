import re

files = [
    '/home/ubuntu/mk/telegram-bot/src/handlers/ops.js',
    '/home/ubuntu/mk/telegram-bot/src/handlers/ops-v4.js',
    '/home/ubuntu/mk/telegram-bot/src/handlers/ops-v5.js',
    '/home/ubuntu/mk/telegram-bot/src/index.js',
    '/home/ubuntu/mk/telegram-bot/src/services/ops-scheduler.js',
]

keywords = [
    'forwardMessage',
    'copyMessage',
    'pinChatMessage',
    'disable_notification',
    'message_thread_id',
    'threadId',
    'General',
    'bot.on',
    'handleOpsPassive',
    'routeToTopic',
    'smartRoute',
    'getTopicInfo',
]

for f in files:
    try:
        with open(f) as fh:
            lines = fh.readlines()
        hits = []
        for i, line in enumerate(lines, 1):
            for kw in keywords:
                if kw.lower() in line.lower():
                    hits.append((i, line.rstrip()))
                    break
        if hits:
            print(f'\n{"="*60}')
            print(f'FILE: {f}')
            print(f'{"="*60}')
            for lineno, text in hits:
                print(f'  {lineno:4d}: {text}')
    except Exception as e:
        print(f'Error reading {f}: {e}')
