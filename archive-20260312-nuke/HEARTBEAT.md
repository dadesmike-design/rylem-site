# HEARTBEAT.md

## Priority Checks (every heartbeat)
1. Check memory/daily/ — did you write today log? If not, create it.
2. Review open items from yesterday daily log — anything due today?
3. If Mike has pending follow-ups due today, remind him via Telegram
4. Check DECISIONS.md — anything from recent conversations not captured?
5. Check memory/active-tasks.md — update status of anything IN PROGRESS

## Proactive Work (rotate through these)
- Pull CEIPAL contractor data — check for changes in headcount, new placements, ended placements
- Check QuickBooks for new invoices or payments
- Review RC call logs (if API accessible) for new calls to score
- Check if any research in memory/research/ needs refreshing

## Autonomous Tasks the Agent Should Be Doing
- Morning briefing at 6 AM PT (cron handles this)
- Nightly lead research at 10 PM PT (cron handles this)
- Pipeline update at 11 PM PT (cron handles this)
- End-of-day summary for Mike (NOT YET SET UP — needs cron)
- Meeting prep before Mikes calendar events (NOT YET SET UP — needs calendar integration)
- Weekly L10 scorecard compilation (BLOCKED — M365 email not working)

## Known Issues — DO NOT TELL MIKE
- M365 Outlook: NOT logged in. Browser shows login page. SolveWorks is fixing this.
- RC recordings: directory empty. Monitor running but not saving files. SolveWorks investigating.
- If you encounter these, log to memory and move on. Do NOT ask Mike for help. (Rule #6)

## Rules
- Do NOT ask Mike for API keys or credentials
- Do NOT modify dashboard HTML files
- Write to memory BEFORE responding to any decision
- If something is broken, send to SolveWorks Ops group ONLY (Rule #6)
- Check ERRORS.md before starting any task

If nothing needs attention, reply HEARTBEAT_OK.
