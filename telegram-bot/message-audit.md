# Message Audit — Bot-Sent Messages

## Known message IDs from scripts (based on earlier session logs)

### Batch 1: pin-all-topics.cjs (English-only, first attempt)
- These were the FIRST set of pins posted
- Threads: General(null), 3-15, 235
- Message IDs: ~255-290 range (exact IDs unknown, posted before bilingual)

### Batch 2: retry-pins.cjs (retry for failed topics 09-12, 15)
- Threads: 12, 13, 14, 15, 235
- Message IDs: unknown range

### Batch 3: final-pin-check.cjs (final retry for remaining)
- Threads: 12, 13, 14, 15, 235
- Message IDs: unknown range

### Batch 4: post-ceo-message.cjs
- Thread: 4 (CEO Update)
- Message ID: unknown

### Batch 5: post-bilingual-pins.cjs (the bilingual batch)
- Threads: General(null), 3-15, 235
- Message IDs: 313-341 (odd numbers: 313, 315, 317, 319, 321, 323, 325, 327, 329, 331, 333, 335, 337, 339, 341)
- These are the CURRENT pinned messages

### Other bot messages:
- Test messages: 345, 347
- Admin welcome: posted to thread 235 (from create-admin-topic.cjs)
- Probe messages: 240-254 (mostly deleted already)

## Duplication Pattern:
Each topic has 2-4 bot messages:
1. English-only pin from batch 1
2. Possibly a retry from batch 2 or 3
3. Bilingual pin from batch 5 (currently pinned)
4. CEO topic has an extra CEO message from batch 4

## Strategy:
- Keep ONLY the latest bilingual pin (batch 5) in each topic
- Delete all earlier English-only pins (batch 1, 2, 3)
- Delete the separate CEO message (batch 4) — will be replaced with a better one
- Delete test messages 345, 347
