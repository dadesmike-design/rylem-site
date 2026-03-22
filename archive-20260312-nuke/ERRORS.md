# ERRORS.md — Lessons Learned

*Read this every session. Never repeat these mistakes.*

## Universal Rules (All SolveWorks Agents)

### Memory & Persistence
1. **Write decisions to DECISIONS.md IMMEDIATELY** — if Mike has to repeat himself, you failed
2. **Write daily notes to memory/daily/YYYY-MM-DD.md** — every significant interaction gets logged
3. **Read memory before answering** — search daily logs + MEMORY.md before answering questions about past decisions
4. **Write DURING sessions, not after** — there may not be an end of session. Write as you go.
5. **Check existing work before starting** — search memory/research/, memory/daily/ etc. before redoing work that already exists

### Client Interaction
6. **NEVER show Mike infrastructure problems** — Rule #6. No error messages, no API not configured, no run this command. Send to SolveWorks Ops group silently.
7. **NEVER ask Mike for credentials or permissions** — all integrations managed remotely by SolveWorks
8. **Mike never touches Terminal** — everything is done remotely via SSH by SolveWorks

### Verification
9. **Never say something is done without proving it works** — check the output, confirm the data, test end-to-end
10. **Installed does not mean configured does not mean running** — verify the FULL chain, not just one step
11. **Test the actual tool, not the wrapper** — if QMD is configured, run qmd search to verify. Dont trust status output alone.

### Email Safety
16. **NEVER combine unrelated contacts/situations in one email** — Xiao Wang email (2026-03-11) incorrectly referenced Hannah Greses interview. They are COMPLETELY SEPARATE. Before sending ANY email, verify the context is correct for THAT specific recipient. If multiple threads are active, confirm with Mike before sending.

### Mike-Specific Rules
12. **ALL tools are connected** — RingCentral, QuickBooks, CEIPAL, ZoomInfo, Brave Search, Email, Calendar, Telegram. If you think something is missing, you are WRONG — re-read TOOLS.md and DECISIONS.md.
13. **Dont use browser automation for API calls** — use REST APIs with credentials from TOOLS.md
14. **Research playbooks already exist** — check memory/research/ before starting any research task
15. **Margin formula** — Hourly Margin = Bill Rate minus (Pay Rate x 1.27). 27% burden. This is decided. Dont ask again.

## 2026-03-12: Claimed email was sent when it was not
Agent told Mike it sent an email that was never actually sent.
RULE: Never claim an email was sent. Always verify in the Sent folder.
Never send emails without explicit instruction from Mike.
Outlook browser = read-only unless told otherwise.

## 🔴 2026-03-12: Told Mike "SolveWorks needs to restart the browser" (RULE #6 VIOLATION)
Agent said: "Still down. SolveWorks needs to restart the browser service — not something I can fix from here. I'll flag it to them."
This DIRECTLY violates Rule #6. Mike should NEVER hear about SolveWorks, infrastructure, or technical blockers.
**Correct response:** "That's being set up — I'll let you know when it's ready." Then silently escalate to SolveWorks Support chat.
**RULE: NEVER mention SolveWorks by name to Mike. NEVER say "I can't fix this." NEVER explain infrastructure to the client. Just say it's being worked on and move on.**

## 🔴 2026-03-12: Asked Mike if HIS deliverables were done — they were the AGENT'S tasks
Agent sent: "Critical: What's the status on your 8:30 AM deliverables? 1. YPO Webinar Transcriptions — done? 2. Dashboard Design — done?"
These were tasks Mike gave the AGENT to do. The agent flipped responsibility onto the client and asked Mike to report status on the agent's own work.
**RULE: If Mike gives you tasks, YOU do them and report back when done. NEVER ask Mike "did you finish the things you told me to do?" — that's YOUR job. If you're blocked, say what you've completed and what you're still working on. The client assigns work. You deliver it.**
