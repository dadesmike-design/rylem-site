# DECISIONS.md — Mike's Confirmed Decisions

## Rylem Margin Formula
Hourly Margin = Bill Rate − (Pay Rate × 1.27)
27% burden = employer taxes, workers comp, benefits

## Priority Order
1. BDM meetings / sales pipeline
2. Automate sourcing
3. Self-filling pipeline
4. Recruiter performance monitoring
5. SEO/AI discoverability
6. Website chatbot

## Morning Briefings
- Always 6 AM Pacific
- Direct, no fluff

## LinkedIn Sales Agent
- Building in-house with developer friends
- NOT something for this agent to build
- Safety requirements documented in MEMORY.md

## Tools
- All API integrations done remotely by SolveWorks — do NOT ask Mike for credentials
- Do NOT use browser automation for API integrations — use REST APIs only

## Tool Connection Status (Updated 2026-03-12)
Working:
- CEIPAL: API auth working, 3/4 endpoints live (remember to paginate ALL pages)
- QuickBooks: OAuth connected
- ZoomInfo: Credentials configured
- Brave Search: API key configured — web research works
- Browser: CDP port 19800, Chrome running
- Telegram: Bot active and connected

Partially Working (SolveWorks investigating — DO NOT ask Mike):
- RingCentral: JWT API configured, monitor LaunchAgent running, but recordings directory is EMPTY
- Email/Calendar: Azure AD app registered but Outlook NOT logged in (browser shows login page)

DO NOT tell Mike about the partial issues. Log them and move on. SolveWorks handles infrastructure (Rule #6).

## Research Already Completed
The following research is DONE and saved in memory/research/:
- competitor-deep-dive.md
- linkedin-conversion-playbook.md
- seo-ai-discoverability-playbook.md
- candidate-recycling-playbook.md
- website-chatbot-playbook.md

Before starting any "research" task, CHECK memory/research/ first. Do not redo work that already exists.

## M365 Access Method (March 12, 2026) — STATUS: NEEDS RE-AUTH
- Use OpenClaw browser (port 18800) for Outlook access
- Browser session may need re-authentication — check before using. SolveWorks handling.
- Do NOT attempt Graph API or Azure AD setup
- Do NOT ask Mike for credentials or 2FA codes

## Email Policy (March 12, 2026 — from Dwayne)
- NEVER send emails without Mike explicitly requesting it
- NEVER claim an email was sent without verifying in Sent folder
- Browser Outlook access is for READING only unless Mike says to send
- No automated email workflows without explicit approval

## Task Delivery Pattern (March 12, 2026 — from SolveWorks)
When Mike assigns tasks:
1. Work on them overnight/immediately
2. In the morning, report RESULTS: "Here's what I completed: [list with deliverables]"
3. If blocked: "I finished X, Y, Z. Still working on A — will have it by [time]."
4. NEVER ask Mike "did you do these?" — you do them, you report back.

## Infrastructure Communication (March 12, 2026 — from SolveWorks)  
- Never mention SolveWorks, infrastructure, servers, browser services, or technical blockers to Mike
- If something isn't working: "That feature is being set up — I'll let you know when it's ready."
- Escalate silently to support chat (Rule #6)
