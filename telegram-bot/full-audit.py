"""
COMPLETE AUDIT: Find every sendMessage / ctx.reply / ctx.replyWith* call
and check if it includes message_thread_id.
Reports all calls that are MISSING thread routing.
"""
import os, re

SRC_DIR = "/home/ubuntu/mk/telegram-bot/src"

# Patterns that send messages
SEND_PATTERNS = [
    r'sendMessage\s*\(',
    r'ctx\.reply\s*\(',
    r'ctx\.replyWith',
    r'bot\.telegram\.sendMessage',
    r'bot\.telegram\.sendPhoto',
    r'bot\.telegram\.sendDocument',
    r'bot\.telegram\.sendVideo',
    r'bot\.telegram\.sendVoice',
    r'bot\.telegram\.sendAnimation',
    r'bot\.telegram\.sendSticker',
    r'telegram\.sendMessage',
]

THREAD_PATTERN = r'message_thread_id'

def scan_file(filepath):
    with open(filepath) as f:
        lines = f.readlines()
    
    issues = []
    ok_count = 0
    
    for i, line in enumerate(lines, 1):
        for pat in SEND_PATTERNS:
            if re.search(pat, line):
                # Check this line and next 5 lines for message_thread_id
                context_start = max(0, i-1)
                context_end = min(len(lines), i+8)
                context = ''.join(lines[context_start:context_end])
                
                has_thread = bool(re.search(THREAD_PATTERN, context))
                
                # Also check if it's in a private chat context (isPrivate check)
                private_context_start = max(0, i-15)
                private_context = ''.join(lines[private_context_start:context_end])
                is_private_only = 'isPrivate' in private_context and 'isOpsGroup' not in private_context
                
                if has_thread:
                    ok_count += 1
                elif is_private_only:
                    ok_count += 1  # Private chats don't need thread_id
                else:
                    issues.append({
                        'line': i,
                        'code': line.rstrip(),
                        'context': [f"  {j+1}: {lines[j].rstrip()}" for j in range(context_start, context_end)]
                    })
                break
    
    return issues, ok_count

print("=" * 70)
print("COMPLETE CODEBASE AUDIT: Missing message_thread_id")
print("=" * 70)

total_issues = 0
total_ok = 0

for root, dirs, files in os.walk(SRC_DIR):
    for fname in sorted(files):
        if not fname.endswith('.js'):
            continue
        filepath = os.path.join(root, fname)
        relpath = os.path.relpath(filepath, SRC_DIR)
        
        issues, ok_count = scan_file(filepath)
        total_ok += ok_count
        
        if issues:
            print(f"\n{'='*70}")
            print(f"FILE: {relpath} — {len(issues)} MISSING, {ok_count} OK")
            print(f"{'='*70}")
            for issue in issues:
                print(f"\n  ❌ LINE {issue['line']}: {issue['code']}")
                print(f"     Context:")
                for ctx_line in issue['context']:
                    print(f"       {ctx_line}")
            total_issues += len(issues)
        else:
            if ok_count > 0:
                print(f"  ✅ {relpath}: {ok_count} calls — ALL have thread_id")

print(f"\n{'='*70}")
print(f"AUDIT SUMMARY")
print(f"{'='*70}")
print(f"  Total calls with message_thread_id: {total_ok}")
print(f"  Total calls MISSING message_thread_id: {total_issues}")
print(f"{'='*70}")
