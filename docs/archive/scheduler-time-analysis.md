# Scheduler Time Analysis

ksaNow() adds +3 hours to UTC, then getUTCHours() is called on the shifted date.
So the hour value in the code IS the KSA hour directly.

## Current Code vs Documented Schedule

| Function | Comment says | Code checks | Actual KSA time | Bug? |
|---|---|---|---|---|
| sendMorningBriefing | 9 AM KSA | hour !== 6 | 6 AM KSA | YES — should be 9 |
| sendDailyReport | 9 PM KSA | hour !== 18 | 6 PM KSA | YES — should be 21 |
| sendEveningReminder | 6 PM KSA | hour !== 15 | 3 PM KSA | YES — should be 18 |
| syncToGoogle | 9:15 PM KSA | hour !== 18 | 6:15 PM KSA | YES — should be 21 |
| sendCheckinReminder | 5 PM KSA | hour !== 14 | 2 PM KSA | YES — should be 17 |
| flagUncheckedMembers | 6 PM KSA | hour !== 15 | 3 PM KSA | YES — should be 18 |
| sendWeeklyCeoMessage | Sunday 9 AM KSA | hour !== 6 | 6 AM KSA | YES — should be 9 |
| sendWeeklyStandup | Sunday 9 AM KSA | hour !== 6 | 6 AM KSA | YES — should be 9 |

CONCLUSION: Every single time check is wrong by -3 hours.
The developer likely thought ksaNow() returns UTC and the hour needs to be UTC,
but ksaNow() already shifts to KSA, so the hour IS the KSA hour.

All times are firing 3 hours too early.
