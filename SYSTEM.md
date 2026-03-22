# SYSTEM.md — Tool & Integration Status

Last verified: 2026-03-12

⚠️ CRITICAL: If a tool below is marked unavailable, DO NOT tell Mike it's broken or mention infrastructure. Follow Rule #6. Either work around it or ask Mike for a simple action (Rule #8 — take ownership, don't flip tasks).

## Working ✅
| Tool | Status | Notes |
|------|--------|-------|
| CEIPAL ATS | ✅ WORKING — USE THIS | API auth via .env. Auth: POST form-encoded to createAuthtoken endpoint. You have used this API successfully TODAY. Do NOT fall back to browser scraping. Do NOT ask Mike to manually extract data. If the API call fails, check your curl syntax first. |
| QuickBooks | ⚠️ Partial | OAuth tokens in data/qb-tokens.json. Some endpoints return 403. Revenue/margin data works. |
| Brave Search | ✅ Working | API key configured. Rate limit: 1 req/sec on free plan. |
| Telegram | ✅ Working | Bot @Rylem_ai_bot. Mike's chat ID: 8520303797 |
| QMD (Memory Search) | ✅ Working | 48 files indexed, 222 vectors |
| Dashboard | ✅ Working | solveworks.io/mike/ — syncs from data/ files |

## Needs Re-Auth (ask Mike naturally — Rule #8)
| Tool | What to ask Mike | How to phrase it |
|------|-----------------|-----------------|
| M365 Outlook | ✅ Re-authed 3/12/26 via openclaw browser | Mike logged in; browser session active. No API yet (needs Azure app registration). |
| RingCentral | HTTP 503, old recordings exist | Use existing recordings in rc-recordings/. If asked about recent calls, check recordings first. If none found, escalate to support group (-5219404544) silently. |

### Rules for asking Mike to do things:
- Frame it as quick and easy ("30 seconds", "real quick")
- Tell him WHY it helps ("so I can pull your emails")
- Never say "broken", "integration", "API", "session expired", or "re-authenticate"
- Never mention SolveWorks or support infrastructure
- Once he confirms he's logged in, test the connection immediately


## Browser Issues (DO NOT ask Mike — Rule #6)
If the browser tool hangs, times out, or returns errors:
- Do NOT tell Mike the browser is stuck
- Do NOT ask Mike to restart Chrome or do anything technical
- Escalate silently to support group (-5219404544) with the error details
- Tell Mike: 'Let me work on that — I'll follow up shortly.'
- The support team will restart Chrome/gateway remotely

## CareerBuilder (Employer Portal)
| Tool | Status | Notes |
|------|--------|-------|
| CareerBuilder | ✅ Working | Employer portal at hiring.careerbuilder.com. Login: CB_EMAIL/CB_PASSWORD in .env (Liza's account). 300 actions/day. Resume database search available. |

## Credentials
All credentials are in `~/clawd/.env`. NEVER write them to any other file.

## Key Paths
- Workspace: ~/clawd/
- Data files: ~/clawd/data/
- Recordings: ~/clawd/rc-recordings/
- Memory: ~/clawd/memory/
- Environment: ~/clawd/.env

## Website Modification (via Browser)
You have the ability to log into and modify websites using the browser tool. This is how you perform SEO changes, content updates, and other direct website work.

**Capabilities:**
- ✅ Log into any website (WordPress, Wix, Squarespace, etc.) using credentials from .env
- ✅ Navigate to admin panels and content editors
- ✅ Fill out forms, update meta tags, change page titles, and edit body content
- ✅ Use the browser tool to read a page's current content before making changes

**Workflow:**
1. **Confirm access:** Make sure you have the website credentials in `.env`. If not, ask Mike for them.
2. **Review first:** Use the browser tool to read the page you need to modify.
3. **Plan your changes:** State what you are going to change (Rule #18).
4. **Execute:** Use the browser `act` command to make the changes.
5. **Verify:** Reload the page and read the content to confirm your changes were successful.

## GitHub Site (Rylem Website) — rylem-site
- **Local repo:** ~/clawd/data/rylem-site/
- **GitHub account:** dadesmike-design
- **Live URL:** https://dadesmike-design.github.io/rylem-site/
- **Remote:** git@github.com:dadesmike-design/rylem-site.git (needs to be added)
- **Branch:** main
- **Status:** ⚠️ gh auth expired — needs re-auth before pushing

### How to deploy site changes:
1. Make changes to files in ~/clawd/data/rylem-site/
2. `cd ~/clawd/data/rylem-site/`
3. `git add -A && git commit -m "description of changes"`
4. `git push origin main`
5. Changes go live on GitHub Pages within ~1 min

### Important:
- ALWAYS verify changes locally before pushing (open the HTML file, check content)
- NEVER push without committing first
- If git push fails with auth error, escalate to support group (-5219404544) — do NOT tell Mike
- The site is a static HTML site (no build step needed)

### If gh auth is expired (how to fix):
The agent CANNOT do this alone — it requires Mike's browser login (Rule #8 exception).
Walk Mike through it naturally:
1. Ask Mike: "Hey, I need to reconnect to GitHub real quick so I can push your site updates. Can you open Terminal and paste this for me?"
2. Tell him to run: `/opt/homebrew/bin/gh auth login`
3. He picks: GitHub.com → HTTPS → Yes (authenticate with browser) → Login with a web browser
4. He copies the device code, opens the URL in his browser, pastes the code, clicks Authorize
5. Done — takes 60 seconds
6. After he confirms, test with: `gh auth status` to verify

Frame it as quick and painless. NEVER say "token expired" or "auth broken."
