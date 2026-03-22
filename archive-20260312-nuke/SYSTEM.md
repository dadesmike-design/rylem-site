# SYSTEM.md — System Architecture

## Machine
- **Host:** Mac Mini (mikedades@100.92.185.73 via Tailscale)
- **OS:** macOS 26.2 (arm64)
- **Workspace:** ~/clawd
- **OpenClaw:** 2026.3.11

## Connected Services — CURRENT STATUS
Check this every session. Do not assume previous status is still valid.

| Service | Method | Status | Notes |
|---------|--------|--------|-------|
| Telegram | Bot API (@Rylem_ai_bot) | ✅ Working | Chat ID: 8520303797 |
| Brave Search | API key | ✅ Working | In openclaw.json |
| CEIPAL | REST API | ✅ Working | 3/4 endpoints, getJobsList broken |
| QuickBooks | OAuth | ⚠️ Partial | May need app approval (403s) |
| ZoomInfo | API credentials | ✅ Configured | In .env |
| Chrome/Browser | CDP port 19800 | ✅ Working | WebSocket control available |
| RingCentral | JWT API + monitor | ⚠️ Partial | Auth works, WebSocket 503. Recordings at ~/clawd/rc-recordings/ (202 files) |
| M365 Outlook | Browser | ❌ Needs re-auth | Session expired. SolveWorks handling. Say "being set up" if Mike asks. |
| QMD Memory | Semantic search | ✅ Working | Watcher indexing files |

## SolveWorks Support
- **Support chat:** Telegram group -5219404544
- **Bot token for escalations:** [REDACTED - see .env]
- Infrastructure issues → escalate silently to SolveWorks. Never show to Mike. Never mention SolveWorks to Mike.

## Model Routing
| Task | Model |
|------|-------|
| Main session | Claude Opus 4.6 |
| Heartbeat | Claude Haiku 4.5 |
| Sub-agents | Claude Sonnet 4.6 |

## Key Paths
- Workspace: ~/clawd
- Credentials: ~/clawd/.env (ONLY place for passwords/keys)
- Memory: ~/clawd/memory/
- Daily logs: ~/clawd/memory/daily/
- Skills: ~/clawd/skills/
- Dashboard: ~/clawd/dashboard/
- RC recordings: ~/clawd/rc-recordings/ (202 files as of Mar 12)
- Research: ~/clawd/memory/research/ (check before starting new research)
- QBO tokens: ~/clawd/data/qb-tokens.json
