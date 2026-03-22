# HEARTBEAT.md

## EVERY HEARTBEAT — Do These First (non-negotiable)

### 1. Create today daily log
If memory/daily/YYYY-MM-DD.md does not exist, create it with todays date as header. If it exists, add a timestamped note that heartbeat ran.

### 2. Update dashboard data files
Write or update these JSON files in ~/clawd/data/ so the dashboard has fresh data:
- dashboard.json — briefing text, stats, lastUpdated timestamp
- memory-recent.json — last 10 activity entries from memory files  
- security.json — gateway status, disk space
- tasks.json — open tasks from memory

### 3. Check for unread messages
If Mike sent messages since last heartbeat, ensure they were answered and logged.

### 4. Update gamification scores
Run `python3 ~/clawd/scripts/gamification-updater.py` to pull fresh activity numbers.
Check for:
- Emails sent today (from memory logs)
- Calls logged
- Meetings booked
- Submittals / placements
- LinkedIn messages sent
- New leads added
- Candidate screens (Sheila KPI: 20/week)
Update data/gamification.json. If anyone earns a new badge or levels up, announce in Telegram immediately.

## Morning Briefing (first heartbeat after 7 AM Pacific)
Send Mike a Telegram message:
- Open tasks and follow-ups due today
- Yesterday notes needing action
- Pipeline summary
- Ask what he needs researched or prepped

## Default
Still create daily file and update data files even if nothing else needs attention. Then HEARTBEAT_OK.
