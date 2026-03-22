# ONBOARDING.md — Tool Connection Guide

When Mike wants to connect a tool, walk him through it ONE AT A TIME. Keep it simple. No jargon.

## Status
- [ ] QuickBooks
- [ ] CEIPAL
- [ ] ZoomInfo  
- [ ] RingCentral

## QuickBooks (OAuth — easiest)
When Mike says he wants to connect QuickBooks:
1. Tell him: "I'll need you to log into QuickBooks in your browser real quick. Go to quickbooks.intuit.com and make sure you're signed in."
2. Then: "Go to Settings (gear icon) → Account and Settings → click on your Company Name at the top. I need your Company ID — it's in the URL bar after you click. It looks like a number like 123456789."
3. When he gives you the Company ID, save it to ~/clawd/.env as QUICKBOOKS_COMPANY_ID
4. For API access: "Now go to developer.intuit.com, sign in with the same QuickBooks account, and create an app. Pick 'Accounting' when it asks. Then copy the Client ID and Client Secret."
5. Save both to .env as QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET
6. Mark QuickBooks as connected: update this file, check the box

**SIMPLER ALTERNATIVE:** If Mike doesn't want to deal with developer portal, tell him:
"No worries — I can pull your financial data another way. Just forward me your QuickBooks P&L report email each month, or I can screen-scrape it from the browser on this machine. Which would you prefer?"

## CEIPAL (API Key)
When Mike says he wants to connect CEIPAL:
1. Tell him: "Open CEIPAL and go to Settings → API Settings (or Integration Settings). You should see an API Key or Token there. Just copy it and paste it here."
2. If he can't find it: "Try Settings → General → API Configuration. Or search 'API' in the CEIPAL settings search bar."
3. When he sends the key, save to ~/clawd/.env as CEIPAL_API_KEY
4. Also ask: "What's your CEIPAL subdomain? It's the part before .ceipal.com in your URL when you're logged in."
5. Save as CEIPAL_SUBDOMAIN
6. Mark CEIPAL as connected

## ZoomInfo (API Key)
When Mike says he wants to connect ZoomInfo:
1. Tell him: "In ZoomInfo, go to Admin → Integrations → API. You should see your API key there. Copy and paste it here."
2. If he can't find it: "Try clicking your profile icon → Admin Portal → Integrations tab → look for 'API Access' or 'Developer'."
3. When he sends it, save to ~/clawd/.env as ZOOMINFO_API_KEY
4. Mark ZoomInfo as connected

## RingCentral (OAuth)
When Mike says he wants to connect RingCentral:
1. Tell him: "Go to developers.ringcentral.com and sign in with your RingCentral account."
2. "Click 'Create App' → REST API App → fill in the name as 'Rylem AI' → select 'Private' → check 'Read Call Log' and 'Read Call Recording'."
3. "Copy the Client ID and Client Secret and paste them here."
4. Save to .env as RINGCENTRAL_CLIENT_ID and RINGCENTRAL_CLIENT_SECRET
5. Mark RingCentral as connected

## Rules
- NEVER ask for all tools at once. One at a time.
- If Mike gets frustrated or confused, STOP and offer the simpler alternative.
- After each connection, immediately test it and confirm it works before moving to the next.
- Don't push tools Mike doesn't ask about. He'll connect them when he's ready.
- When a tool is connected, tell Mike what new capabilities he just unlocked.
