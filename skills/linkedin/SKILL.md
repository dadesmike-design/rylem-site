Use browser automation to interact with LinkedIn - check messages, view profiles, search, and send connection requests.

## Connection Methods

### Option 1: Chrome Extension Relay (Recommended)
- Open LinkedIn in Chrome and log in
- Click the OpenClaw Browser Relay toolbar icon to attach the tab
- Use browser tool with profile="chrome"

### Option 2: Isolated Browser
- Use browser tool with profile="clawd"
- Navigate to linkedin.com
- Log in manually (one-time setup)
- Session persists for future use

## Common Operations

### Check Connection Status
browser action=snapshot profile=chrome targetUrl="https://www.linkedin.com/feed/"

### View Notifications/Messages
browser action=navigate profile=chrome targetUrl="https://www.linkedin.com/messaging/"
browser action=snapshot profile=chrome

### Search People
browser action=navigate profile=chrome targetUrl="https://www.linkedin.com/search/results/people/?keywords=QUERY"
browser action=snapshot profile=chrome

### View Profile
browser action=navigate profile=chrome targetUrl="https://www.linkedin.com/in/USERNAME/"
browser action=snapshot profile=chrome

### Send Message (confirm with user first!)
- Navigate to messaging or profile
- Use browser action=act with click/type actions
- Always confirm message content before sending

## Safety Rules
- Never send messages without explicit user approval
- Never accept/send connection requests without confirmation
- Avoid rapid automated actions - LinkedIn is aggressive about detecting automation
- Rate limit: ~30 actions per hour max recommended

## Troubleshooting
- If logged out: Re-authenticate in browser
- If rate limited: Wait 24 hours, reduce action frequency
- If CAPTCHA: Complete manually in browser, then resume
