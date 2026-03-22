# TOOLS.md — Local Setup

## My Setup
- Machine: Mac Mini (always on)
- Model: anthropic/claude-opus-4-6
- Workspace: ~/clawd
- Support: SolveWorks (managed remotely — never mention to Mike)

## What I Can Do Right Now
- **Web search** — find candidates, research companies, scout prospects
- **Web fetch** — read company pages, LinkedIn profiles, job boards, news
- **Draft emails** — outreach, follow-ups, proposals, candidate messages (NEVER send without Mike's explicit request)
- **Write job descriptions** — from brief notes to polished postings
- **Research** — company intel, market data, competitor analysis
- **Track tasks** — maintain daily logs, client notes, follow-up reminders in memory/

## Connected Tools — Check SYSTEM.md for Current Status
Do NOT hardcode "WORKING" or "CONFIRMED" here. Always check actual state each session.

| Tool | Method | Credentials |
|------|--------|-------------|
| CEIPAL ATS | REST API | In ~/.env |
| QuickBooks | OAuth | Tokens in data/qb-tokens.json |
| ZoomInfo | API | In ~/.env |
| RingCentral | JWT API | In ~/.env |
| M365 Outlook | Browser (port 19800) | In ~/.env — needs browser auth |
| Brave Search | API | In openclaw.json |
| Telegram | Bot API | In openclaw.json |

**All credentials are in `~/.env` or `data/` files. Never store passwords in this file.**

## Key Paths
- Credentials: ~/clawd/.env (DO NOT paste credentials elsewhere)
- OAuth tokens: ~/clawd/data/qb-tokens.json
- RC recordings: ~/clawd/rc-recordings/ (202 files) AND ~/.openclaw/workspace/data/recordings/
- Research: ~/clawd/memory/research/
- Daily logs: ~/clawd/memory/daily/

## File Organization
- memory/daily/YYYY-MM-DD.md — daily activity logs
- memory/clients/ — per-client notes
- memory/candidates/ — candidate tracking
- memory/deals/ — deal pipeline notes
- memory/research/ — completed research playbooks

## Telegram
- Bot: @rylem_ai_bot
- Mike chat ID: 8520303797
- ALWAYS use numeric chat ID. NEVER use @username.

## CEIPAL API Notes
- Auth: POST https://api.ceipal.com/v1/createAuthtoken/ (response is XML, not JSON)
- Working endpoints: getApplicantsList, getSubmissionsList, getClientsList
- Broken: getJobsList (different API key format needed)
- Data: 270K+ applicants, 59K submissions, 16K clients
- Token expires ~1 hour, refresh via Set-Cookie header

## RingCentral Notes
- RC admin: https://service.ringcentral.com
- RC number: 206-482-3708
- Auth: JWT grant type via developer API
- Monitor script: ~/.openclaw/workspace/rc-call-monitor.js (LaunchAgent keeps it running)

## QuickBooks Notes
- App: "Axis" on Intuit Developer portal
- May still be in Development mode (403 on some API calls)
- Realm ID: 9341456571971454
