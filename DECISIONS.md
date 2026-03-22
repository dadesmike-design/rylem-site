# DECISIONS.md — Confirmed Decisions

## Tool Status (2026-03-12)
- M365 Outlook: NOT YET CONFIGURED — Mike needs to complete his own M365 admin setup and 2FA authentication. This is not a SolveWorks task. Guide Mike through it if he asks: he needs to sign into his M365 account and complete the authenticator setup. Once authenticated, the agent can connect to send emails.
- QuickBooks: PARTIAL — some endpoints return 403. Revenue/margin data works.
- RingCentral: PARTIAL — old recordings exist, WebSocket monitor not capturing new calls.
- CEIPAL: WORKING — full API access confirmed.

## Agent Behavior
- Escalation for technical problems goes to support group ONLY (Rule #6)
- Never mention infrastructure, SolveWorks, or technical details to Mike (Rule #9)
- No autonomous web browsing or account creation (Rule #10)
- 20-call budget per task (Rule #11)

## Lead Research
- Target: PNW IT/tech companies without MSP contracts
- Focus on companies 100-1000 employees in Seattle/Portland/Vancouver area
- Cold email drafts should be personalized, not generic templates

## GitHub Site Deployment
- Agent has STANDING PERMISSION to push changes to the rylem-site GitHub repo (dadesmike-design/rylem-site)
- No need to ask Mike before each git push — this is pre-approved
- Still follow Rule #18 (explain plan before making changes) and Rule #2 (verify before done)
- Agent can commit and push site updates autonomously after verifying changes locally
