# SolveWorks Dashboard JSON Schemas

> **Version:** 1.0 | **Last Updated:** 2026-03-09 | **Owner:** Mika (SolveWorks HQ)
>
> This file defines every JSON data file consumed by the SolveWorks dashboard.
> Your agent reads this to know exactly what to produce. Follow these schemas precisely.
> All files live in `~/clawd/dashboard/data/` on the client machine.

---

## Core Files (All Clients)

### `dashboard.json`
**Purpose:** Top-level stats displayed in the dashboard header/summary bar.  
**Updated by:** sync.sh (auto-computed from tasks.json), or agent directly.

```json
{
  "inProgress": 5,
  "completed": 10,
  "waiting": 22,
  "agents": 1,
  "lastSync": "2026-03-09T16:05:37Z",
  "timestamp": "2026-03-09T16:05:37Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inProgress` | integer | ✅ | Count of tasks currently in progress |
| `completed` | integer | ✅ | Count of completed tasks |
| `waiting` | integer | ✅ | Count of tasks waiting/blocked |
| `agents` | integer | ✅ | Number of active agents |
| `lastSync` | string (ISO 8601) | ✅ | Timestamp of last successful sync |
| `timestamp` | string (ISO 8601) | ✅ | Same as lastSync (legacy compat) |

---

### `agents.json`
**Purpose:** Agent roster displayed in the agents panel.  
**Updated by:** sync.sh (reads from client SOUL.md), or agent directly.

```json
{
  "agents": [
    {
      "name": "Brit",
      "role": "AI Chief of Staff — Operations & Strategy",
      "status": "active",
      "description": "You are Darryl's AI chief of staff. Sharp, direct, zero fluff."
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agents[].name` | string | ✅ | Agent display name |
| `agents[].role` | string | ✅ | Role title |
| `agents[].status` | string | ✅ | `"active"`, `"inactive"`, or `"error"` |
| `agents[].description` | string | ✅ | Short description of agent capabilities |

---

### `tasks.json`
**Purpose:** Task list panel showing active work items, completed items, and waiting items.  
**Updated by:** sync.sh (parsed from active-tasks.md), or agent directly.

```json
{
  "tasks": [
    {
      "name": "Complete mortgage application with Nick",
      "status": "in-progress"
    },
    {
      "name": "Follow up with Nick for backup mortgage options",
      "status": "waiting"
    },
    {
      "name": "Initial product positioning document",
      "status": "completed"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tasks[].name` | string | ✅ | Task description |
| `tasks[].status` | string | ✅ | `"in-progress"`, `"waiting"`, `"completed"` |

---

### `security.json`
**Purpose:** Security status panel showing system health checks.  
**Updated by:** sync.sh (reads security-check.json from client), or agent directly.

```json
{
  "status": "ok",
  "lastCheck": "2026-03-09T16:05:36Z",
  "details": "No security issues detected. System operational.",
  "checks": [
    {
      "name": "SSH Access",
      "pass": true,
      "detail": "Tailscale connected"
    },
    {
      "name": "Agent Status",
      "pass": true,
      "detail": "Brit operational"
    },
    {
      "name": "Workspace Integrity",
      "pass": true,
      "detail": "All files intact"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | ✅ | `"ok"`, `"warning"`, or `"error"` |
| `lastCheck` | string (ISO 8601) | ✅ | Timestamp of last security check |
| `details` | string | ✅ | Human-readable summary |
| `checks[]` | array | ✅ | Individual check results |
| `checks[].name` | string | ✅ | Check name |
| `checks[].pass` | boolean | ✅ | Whether check passed |
| `checks[].detail` | string | ✅ | Check detail/explanation |

---

### `travel.json`
**Purpose:** Travel itinerary panel showing upcoming and past trips with flights and hotels.  
**Updated by:** Agent (from email parsing, calendar, manual input).

```json
{
  "lastUpdated": "2026-03-09T05:00:00.000000",
  "filterRule": "Only confirmed bookings — hotel OR flight data required",
  "trips": [
    {
      "id": "mrc-vegas-2026",
      "destination": "Las Vegas, NV",
      "purpose": "MRC Vegas Conference 2026",
      "type": "business",
      "status": "upcoming",
      "startDate": "2026-03-16",
      "endDate": "2026-03-18",
      "flights": [
        {
          "direction": "outbound",
          "from": "YLW",
          "to": "YVR",
          "flightNum": "AC273",
          "departure": "2026-03-16T10:25",
          "arrival": "2026-03-16T11:30",
          "confirmation": "AVU5QN",
          "airline": "Air Canada"
        }
      ],
      "hotels": [
        {
          "name": "Aria Hotel",
          "checkIn": "2026-03-16",
          "checkOut": "2026-03-18",
          "confirmation": "9CBMG6TO"
        }
      ],
      "notes": "MRC Vegas Conference — Revaly Booth 103."
    }
  ],
  "pastTrips": [
    {
      "id": "montreal-condo-2026",
      "destination": "Montréal, QC",
      "purpose": "Condo Visit",
      "type": "personal",
      "status": "completed",
      "startDate": "2026-02-21",
      "endDate": "2026-02-21",
      "flights": [],
      "hotels": [],
      "notes": ""
    }
  ],
  "pendingConfirmation": [
    "YPO Northern Lights Chapter Retreat — Yellowknife, NT (Mar 6-8) — save-the-date only"
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lastUpdated` | string (ISO 8601) | ✅ | When travel data was last refreshed |
| `filterRule` | string | ❌ | Human-readable note about inclusion criteria |
| `trips[]` | array | ✅ | Upcoming/active trips |
| `trips[].id` | string | ✅ | Unique trip identifier (slug format) |
| `trips[].destination` | string | ✅ | Destination city/region |
| `trips[].purpose` | string | ✅ | Trip purpose description |
| `trips[].type` | string | ✅ | `"business"` or `"personal"` |
| `trips[].status` | string | ✅ | `"upcoming"`, `"in-progress"`, `"completed"` |
| `trips[].startDate` | string (YYYY-MM-DD) | ✅ | Trip start date |
| `trips[].endDate` | string (YYYY-MM-DD) | ✅ | Trip end date |
| `trips[].flights[]` | array | ✅ | Flight segments (can be empty) |
| `trips[].flights[].direction` | string | ✅ | `"outbound"` or `"return"` |
| `trips[].flights[].from` | string | ✅ | Departure airport code (IATA) |
| `trips[].flights[].to` | string | ✅ | Arrival airport code (IATA) |
| `trips[].flights[].flightNum` | string | ✅ | Flight number (e.g., `"AC273"`) |
| `trips[].flights[].departure` | string (ISO 8601) | ✅ | Departure datetime |
| `trips[].flights[].arrival` | string (ISO 8601) | ✅ | Arrival datetime |
| `trips[].flights[].confirmation` | string | ✅ | Booking reference code |
| `trips[].flights[].airline` | string | ✅ | Airline name |
| `trips[].hotels[]` | array | ✅ | Hotel bookings (can be empty) |
| `trips[].hotels[].name` | string | ✅ | Hotel name |
| `trips[].hotels[].checkIn` | string | ✅ | Check-in date |
| `trips[].hotels[].checkOut` | string | ✅ | Check-out date |
| `trips[].hotels[].confirmation` | string | ❌ | Booking confirmation number |
| `trips[].hotels[].address` | string | ❌ | Hotel address |
| `trips[].notes` | string | ❌ | Additional trip notes |
| `pastTrips[]` | array | ❌ | Completed trips (same schema as `trips[]`) |
| `pendingConfirmation[]` | array of strings | ❌ | Save-the-dates without confirmed bookings |

**Note:** Drew's travel schema also supports `itinerary[]` (day-by-day items) and `research` (object). These are optional extensions:

```json
{
  "itinerary": [
    {
      "date": "Thu, Feb 26",
      "items": ["Fly Halifax → Montreal (AC 661)", "Travel to Whistler"]
    }
  ],
  "research": {}
}
```

---

### `meetings.json`
**Purpose:** Upcoming meetings/calendar panel.  
**Updated by:** sync.sh (from calendar reader), or agent directly.

```json
{
  "meetings": [
    {
      "id": "5c7c376b",
      "title": "Soojin Jun and Drew Millington",
      "datetime": "2026-02-22T11:00:00",
      "duration": "30 min",
      "location": "https://us02web.zoom.us/j/85804639800",
      "attendees": ["jun.soojin@gmail.com"],
      "category": "Charlie",
      "prep": []
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meetings[]` | array | ✅ | List of upcoming meetings |
| `meetings[].id` | string | ✅ | Unique meeting identifier |
| `meetings[].title` | string | ✅ | Meeting title |
| `meetings[].datetime` | string (ISO 8601) | ✅ | Meeting start time |
| `meetings[].duration` | string | ✅ | Duration (e.g., `"30 min"`, `"1 hr"`) |
| `meetings[].location` | string | ❌ | Meeting URL or physical address |
| `meetings[].attendees` | array of strings | ❌ | Attendee emails |
| `meetings[].category` | string | ❌ | Category label (e.g., `"Charlie"`, `"Personal"`) |
| `meetings[].prep` | array | ❌ | Prep notes (strings or objects) |

---

### `memory-recent.json`
**Purpose:** Recent memory/journal entries panel showing agent activity over last 7 days.  
**Updated by:** sync.sh (pulls from client `memory/` directory).

```json
{
  "entries": [
    {
      "date": "2026-03-09",
      "content": "# Weekly Productivity Planner — Week of March 9, 2026\n\n## Context\n- Elder School week..."
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entries[]` | array | ✅ | Recent memory entries, sorted newest first |
| `entries[].date` | string | ✅ | Date identifier (YYYY-MM-DD or YYYY-MM-DD-suffix) |
| `entries[].content` | string | ✅ | Full markdown content of the memory entry |

---

### `documents.json`
**Purpose:** Document library panel showing key files organized by folder.  
**Updated by:** sync.sh (reads from client workspace directories).

```json
{
  "folders": [
    {
      "name": "strategy-docs",
      "files": ["revaly-brand-messaging.md", "revaly-positioning.pdf"]
    },
    {
      "name": "revaly/weekly-digests",
      "files": ["2026-03-01.md", "2026-03-08.md"]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `folders[]` | array | ✅ | Document folders |
| `folders[].name` | string | ✅ | Folder name/path |
| `folders[].files` | array of strings | ✅ | Filenames within the folder |

---

### `call-analyses.json`
**Purpose:** Call recording analysis panel showing recent analyzed calls.  
**Updated by:** Agent (from Fathom/call transcript processing).

```json
{
  "analyses": [
    {
      "contact": "2026-03-05-kelly-jefferson-charlie-demo",
      "date": "2026-03-05",
      "business": "Charlie",
      "takeaways": [],
      "filename": "2026-03-05-kelly-jefferson-charlie-demo.md"
    }
  ],
  "updatedAt": "2026-03-09T16:00:00.819485+00:00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `analyses[]` | array | ✅ | Analyzed call records |
| `analyses[].contact` | string | ✅ | Contact/call identifier |
| `analyses[].date` | string (YYYY-MM-DD) | ✅ | Call date |
| `analyses[].business` | string | ❌ | Business context |
| `analyses[].takeaways` | array of strings | ✅ | Key takeaways from the call |
| `analyses[].filename` | string | ❌ | Reference filename for full transcript |
| `updatedAt` | string (ISO 8601) | ❌ | When analyses were last refreshed |

---

### `opportunity-intel.json`
**Purpose:** Opportunity intelligence/market insights panel.  
**Updated by:** Agent (from competitive research, news scanning).

**Format A — Structured items (preferred for Darryl-style dashboards):**
```json
{
  "content": "No opportunity intel scans found yet.",
  "date": "2026-03-09"
}
```

**Format B — Rich markdown (used by Drew):**
```json
{
  "content": "# Opportunity Intel — Monday March 9, 2026\n\n## 🔥 TOP SIGNAL: ...",
  "date": "2026-03-09"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | ✅ | Markdown-formatted intelligence content |
| `date` | string (YYYY-MM-DD) | ✅ | Date of the intel scan |

---

### `email-triage.json`
**Purpose:** Email triage/priority inbox panel.  
**Updated by:** Agent (from email processing).

```json
[]
```

Array of email triage items. Schema TBD per client — currently empty for both clients. When populated:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| (root) | array | ✅ | Array of triaged email items |

---

### `outreach-drafts.json`
**Purpose:** Draft outreach messages awaiting review.  
**Updated by:** Agent.

```json
[]
```

Array of outreach draft items. Schema TBD per client — currently empty.

---

### `reports.json`
**Purpose:** Generated reports panel.  
**Updated by:** Agent.

```json
[]
```

Array of report items. Schema TBD per client — currently empty.

---

## Darryl-Specific Files

### `one-thing.json`
**Purpose:** "One Thing" focus panel — the single most important action for the day.  
**Updated by:** Agent (from overnight analysis, weekly planner).

```json
{
  "insight": "Montreal property financing deadline (April 3) requires immediate action.",
  "why": "With only 34 days remaining until closing, BNC Bank needs the chartered appraisal...",
  "action": "Contact Nicholas Zarikos at BNC Bank today (+1 438-870-2841).",
  "generatedAt": "2026-02-27T06:00:00-08:00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `insight` | string | ✅ | The key insight/priority |
| `why` | string | ✅ | Why this matters right now |
| `action` | string | ✅ | Specific action to take |
| `generatedAt` | string (ISO 8601) | ✅ | When this was generated |

---

### `anomalies.json`
**Purpose:** Anomaly detection panel showing flagged issues and risks.  
**Updated by:** Agent (from pattern detection, intelligence analysis).

```json
{
  "lastUpdated": "2026-02-27T06:00:00-08:00",
  "anomalies": [
    {
      "id": "property-financing-critical-feb2026",
      "icon": "🏠",
      "title": "URGENT: Montreal Property Financing Deadline",
      "detail": "April 3rd closing in 34 days requires immediate action.",
      "severity": "high",
      "dismissed": false,
      "createdAt": "2026-02-27T06:00:00-08:00"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lastUpdated` | string (ISO 8601) | ✅ | When anomalies were last refreshed |
| `anomalies[]` | array | ✅ | List of detected anomalies |
| `anomalies[].id` | string | ✅ | Unique anomaly identifier (slug format) |
| `anomalies[].icon` | string | ✅ | Emoji icon for display |
| `anomalies[].title` | string | ✅ | Anomaly title |
| `anomalies[].detail` | string | ✅ | Detailed description |
| `anomalies[].severity` | string | ✅ | `"high"`, `"medium"`, or `"low"` |
| `anomalies[].dismissed` | boolean | ✅ | Whether user dismissed this anomaly |
| `anomalies[].createdAt` | string (ISO 8601) | ✅ | When anomaly was first detected |

---

### `competitor-intel.json`
**Purpose:** Competitive intelligence panel showing recent competitor activity.  
**Updated by:** Agent (from automated competitive scans).

```json
{
  "lastUpdated": "2026-03-09T14:02:18.000Z",
  "items": [
    {
      "id": "chargebacks911-refund-fraud-epidemic-20260309",
      "date": "2026-03-09",
      "summary": "A Sky News article quotes Chargebacks911 CEO on 'refund fraud' epidemic...",
      "source": "Sky News",
      "relevance": "High",
      "competitor": "Chargebacks911"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lastUpdated` | string (ISO 8601) | ✅ | When intel was last refreshed |
| `items[]` | array | ✅ | Competitive intelligence items |
| `items[].id` | string | ✅ | Unique item identifier |
| `items[].date` | string (YYYY-MM-DD) | ✅ | Date of the intelligence |
| `items[].summary` | string | ✅ | Summary of the competitive signal |
| `items[].source` | string | ✅ | Source of the information |
| `items[].relevance` | string | ✅ | `"High"`, `"Medium"`, or `"Low"` |
| `items[].competitor` | string | ✅ | Competitor name or `"Industry"` |

---

### `momentum.json`
**Purpose:** Weekly momentum score and business progress tracking.  
**Updated by:** Agent (from weekly analysis).

```json
{
  "currentScore": 8,
  "currentWeekOf": "2026-03-02",
  "summary": "High-output week with a major new distribution channel...",
  "lastUpdated": "2026-03-06T09:00:00-08:00",
  "status": "active",
  "history": [
    {
      "weekOf": "2026-03-02",
      "score": 8,
      "summary": "Checkout.com pilot structured, BoA/Kount strategy resolved..."
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentScore` | integer (1-10) | ✅ | Current week's momentum score |
| `currentWeekOf` | string (YYYY-MM-DD) | ✅ | Monday of the scored week |
| `summary` | string | ✅ | Narrative summary of the week |
| `lastUpdated` | string (ISO 8601) | ✅ | When score was last updated |
| `status` | string | ✅ | `"active"` or `"pending-setup"` |
| `history[]` | array | ✅ | Historical weekly scores |
| `history[].weekOf` | string (YYYY-MM-DD) | ✅ | Monday of the week |
| `history[].score` | integer (1-10) | ✅ | Score for that week |
| `history[].summary` | string | ✅ | Summary for that week |

---

### `goals.json`
**Purpose:** Goal tracking panel.  
**Updated by:** Agent (after user defines goals).

```json
{
  "goals": [],
  "lastUpdated": "2026-02-27T16:00:00Z",
  "status": "pending-setup",
  "setupRequested": "2026-02-27T16:00:00Z",
  "note": "Weekly goals tracker setup initiated. Awaiting user input."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `goals[]` | array | ✅ | List of tracked goals |
| `lastUpdated` | string (ISO 8601) | ✅ | When goals were last updated |
| `status` | string | ✅ | `"active"` or `"pending-setup"` |
| `setupRequested` | string (ISO 8601) | ❌ | When setup was initiated |
| `note` | string | ❌ | Status note |

---

### `health.json`
**Purpose:** Health data panel (bloodwork, DEXA scans, fitness tracking).  
**Updated by:** Agent (from health data uploads and analysis).

```json
{
  "health": [
    {
      "date": "2026-02-25",
      "type": "Bloodwork History Analysis",
      "findings": [
        "2.25 years of trend data analyzed (Dec 2023 - Feb 2026)",
        "CRITICAL: Testosterone 1291.1 ng/dL (417% above normal range)"
      ],
      "immediateActions": [
        "Blood donation TODAY for hematocrit crisis (51%)"
      ],
      "trends": {
        "testosterone": "Crisis escalation: 467→669→1291 ng/dL",
        "hematocrit": "Dangerous rise: 39%→45%→51%"
      },
      "riskAssessment": "EMERGENCY - Multiple systems in crisis",
      "status": "COMPLETE - AI comparison analysis finished"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `health[]` | array | ✅ | Health data entries |
| `health[].date` | string (YYYY-MM-DD) | ✅ | Date of health data |
| `health[].type` | string | ✅ | Type of health data |
| `health[].findings` | array of strings | ✅ | Key findings |
| `health[].immediateActions` | array of strings | ❌ | Recommended actions |
| `health[].trends` | object | ❌ | Trend data (key-value pairs) |
| `health[].riskAssessment` | string | ❌ | Overall risk assessment |
| `health[].status` | string | ❌ | Processing status |

*Note: Health entries can have additional subfields (e.g., `keyMetrics`, `metabolicDecision`, `extractionStatus`) depending on the data type. The dashboard renders what's present.*

---

### `learning.json`
**Purpose:** Learning/education tracking panel.  
**Updated by:** Agent.

```json
{
  "topic": null,
  "status": "pending-setup",
  "completedLessons": 0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string or null | ✅ | Current learning topic |
| `status` | string | ✅ | `"active"` or `"pending-setup"` |
| `completedLessons` | integer | ✅ | Count of completed lessons |

---

### `overnight-tasks.json`
**Purpose:** Overnight task completion report — what the agent worked on while the user slept.  
**Updated by:** Agent (from overnight processing crons).

```json
{
  "lastRun": "2026-03-08T23:00:00-08:00",
  "tasks": [
    {
      "title": "BDC Commercial Mortgage — Backup Financing Playbook",
      "summary": "Complete BDC CRE loan analysis for Montreal condo backup path...",
      "status": "complete",
      "source": "Asana task #18 + BDC.ca research + memory context"
    }
  ],
  "lastSummary": "3 tasks completed overnight: (1) BDC backup financing playbook..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lastRun` | string (ISO 8601) | ✅ | When overnight tasks last ran |
| `tasks[]` | array | ✅ | Completed overnight tasks |
| `tasks[].title` | string | ✅ | Task title |
| `tasks[].summary` | string | ✅ | Detailed summary of work done |
| `tasks[].status` | string | ✅ | `"complete"`, `"partial"`, `"failed"` |
| `tasks[].source` | string | ❌ | Data sources used |
| `lastSummary` | string | ✅ | One-line summary of all overnight work |

---

### `activity.json`
**Purpose:** Activity feed showing recent agent actions and events.  
**Updated by:** Agent.

```json
{
  "feed": [
    {
      "timestamp": "2026-02-22T23:00:00",
      "type": "research",
      "title": "Evening strategy session with Brit",
      "detail": "Reviewed Revaly identity, positioning strategy, quoting workflows"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feed[]` | array | ✅ | Activity feed items, sorted newest first |
| `feed[].timestamp` | string (ISO 8601) | ✅ | When the activity occurred |
| `feed[].type` | string | ✅ | `"research"`, `"intel"`, `"alert"`, `"task"` |
| `feed[].title` | string | ✅ | Activity title |
| `feed[].detail` | string | ✅ | Activity description |

---

## Drew-Specific Files

### `leads.json`
**Purpose:** CRM lead board showing pipeline across multiple businesses.  
**Updated by:** Agent (from lead research, scout output).

```json
{
  "boards": [
    {
      "id": "nmbr",
      "name": "Nmbr",
      "color": "#0066FF",
      "leads": [
        {
          "id": "n001",
          "company": "Lullaboo",
          "contact": "Farbod Farsad",
          "title": "Director/Leadership",
          "email": "farbod.farsad@lullaboo.ca",
          "altContacts": ["halim@lullaboo.ca"],
          "stage": "negotiations",
          "source": "Calendar",
          "signal": "Live Nmbr demo booked Feb 23 @ 2:30 PM AST.",
          "notes": "Canadian childcare/daycare SaaS company.",
          "added": "2026-02-22",
          "meetingDate": "2026-02-23",
          "tags": ["demo", "childcare", "Canadian"]
        }
      ]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `boards[]` | array | ✅ | Pipeline boards (one per business) |
| `boards[].id` | string | ✅ | Board identifier |
| `boards[].name` | string | ✅ | Business/board name |
| `boards[].color` | string | ✅ | Hex color for display |
| `boards[].leads[]` | array | ✅ | Leads in this pipeline |
| `boards[].leads[].id` | string | ✅ | Unique lead ID |
| `boards[].leads[].company` | string | ✅ | Company name |
| `boards[].leads[].contact` | string | ✅ | Primary contact name |
| `boards[].leads[].title` | string | ❌ | Contact's title |
| `boards[].leads[].email` | string | ✅ | Primary email |
| `boards[].leads[].altContacts` | array of strings | ❌ | Additional contact emails |
| `boards[].leads[].stage` | string | ✅ | Pipeline stage |
| `boards[].leads[].source` | string | ✅ | How lead was found |
| `boards[].leads[].signal` | string | ❌ | Buying signal |
| `boards[].leads[].notes` | string | ❌ | Notes |
| `boards[].leads[].added` | string (YYYY-MM-DD) | ✅ | Date lead was added |
| `boards[].leads[].meetingDate` | string (YYYY-MM-DD) | ❌ | Scheduled meeting date |
| `boards[].leads[].tags` | array of strings | ❌ | Tags for filtering |

---

### `crm-updates.json`
**Purpose:** CRM pipeline view with stage-based deal tracking.  
**Updated by:** Agent.

```json
{
  "updated": "2026-02-22",
  "pipelines": [
    {
      "id": "nmbr",
      "name": "Nmbr",
      "color": "#0066FF",
      "stages": ["Lead", "Contacted", "Call Booked", "Dead", "Disqualified", "Closed Won"],
      "deals": [
        {
          "id": "n001",
          "company": "Lullaboo",
          "contact": "Farbod Farsad",
          "stage": "Call Booked",
          "source": "Calendar",
          "added": "2026-02-22"
        }
      ]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `updated` | string (YYYY-MM-DD) | ✅ | Last update date |
| `pipelines[]` | array | ✅ | Pipeline definitions |
| `pipelines[].id` | string | ✅ | Pipeline identifier |
| `pipelines[].name` | string | ✅ | Pipeline name |
| `pipelines[].color` | string | ✅ | Hex color |
| `pipelines[].stages` | array of strings | ✅ | Ordered stage names |
| `pipelines[].deals[]` | array | ✅ | Deals in pipeline (same fields as leads) |

---

### `stocks.json`
**Purpose:** Investment/stock watchlist panel.  
**Updated by:** Agent (from market research).

```json
{
  "lastUpdated": "2026-03-09T10:07:32.441545",
  "stocks": [
    {
      "ticker": "ENB.TO",
      "name": "Enbridge Inc.",
      "currentPrice": 70.33,
      "currency": "CAD",
      "week52Low": 57,
      "week52High": 73.71,
      "conservativeEstimate": 76.7,
      "optimisticEstimate": 85.95,
      "yield": "5.5%",
      "rating": "Buy/Accumulate",
      "thesis": "Record 2025 EBITDA ($20B, +7%), 31 consecutive dividend raises...",
      "risks": "D/EBITDA at 4.8x — manageable but limited buffer...",
      "researchDate": "2026-02-24",
      "priceVs52wLow": "+23%"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lastUpdated` | string (ISO 8601) | ✅ | When stock data was refreshed |
| `stocks[]` | array | ✅ | Watchlist entries |
| `stocks[].ticker` | string | ✅ | Stock ticker symbol |
| `stocks[].name` | string | ✅ | Company name |
| `stocks[].currentPrice` | number | ✅ | Current price |
| `stocks[].currency` | string | ✅ | Currency code (`"CAD"`, `"USD"`) |
| `stocks[].week52Low` | number | ✅ | 52-week low |
| `stocks[].week52High` | number | ✅ | 52-week high |
| `stocks[].conservativeEstimate` | number | ❌ | Conservative price target |
| `stocks[].optimisticEstimate` | number | ❌ | Optimistic price target |
| `stocks[].yield` | string | ❌ | Dividend yield |
| `stocks[].rating` | string | ✅ | Buy/hold/sell rating |
| `stocks[].thesis` | string | ✅ | Investment thesis |
| `stocks[].risks` | string | ✅ | Key risks |
| `stocks[].researchDate` | string (YYYY-MM-DD) | ✅ | When research was done |
| `stocks[].priceVs52wLow` | string | ❌ | Price vs 52-week low percentage |

---

### `scout-leads.json`
**Purpose:** Scout agent output — prospected leads with outreach suggestions.  
**Updated by:** Agent (Scout sub-agent output).

```json
{
  "leads": [
    {
      "company": "Karahi Point Halifax",
      "contact": "Adil (Franchisee/Owner)",
      "role": "Franchise Owner",
      "source": "Web Research — itsdatenight.com + karahipoint.com",
      "pipeline": "Nmbr",
      "stage": "new",
      "score": 8,
      "notes": "Pakistani/North Indian restaurant franchise...",
      "suggestedApproach": "Email or Instagram DM referencing the Halifax grand opening...",
      "dateFound": "2026-03-03"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `leads[]` | array | ✅ | Prospected leads |
| `leads[].company` | string | ✅ | Company name |
| `leads[].contact` | string | ✅ | Contact name |
| `leads[].role` | string | ✅ | Contact's role |
| `leads[].source` | string | ✅ | How lead was found |
| `leads[].pipeline` | string | ✅ | Which pipeline this belongs to |
| `leads[].stage` | string | ✅ | `"new"`, `"researched"`, `"ready"` |
| `leads[].score` | integer (1-10) | ✅ | Lead quality score |
| `leads[].notes` | string | ✅ | Research notes |
| `leads[].suggestedApproach` | string | ✅ | Recommended outreach approach |
| `leads[].dateFound` | string (YYYY-MM-DD) | ✅ | When lead was discovered |

---

## Empty/Placeholder Files

These files exist in the data directory but are currently empty arrays `[]` or minimal objects `{}`. They're reserved for future dashboard panels:

| File | Current Content | Notes |
|------|----------------|-------|
| `email-triage.json` | `[]` | Email priority inbox — schema TBD |
| `outreach-drafts.json` | `[]` | Draft messages — schema TBD |
| `reports.json` | `[]` | Generated reports — schema TBD |
| `crm-updates.json` (Darryl) | `[]` | Darryl doesn't use CRM board |

---

## Schema Rules

1. **All dates use ISO 8601** — `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:MM:SSZ` for timestamps
2. **All files must be valid JSON** — agent must validate before writing
3. **Arrays can be empty but must exist** — don't omit required array fields
4. **Unknown fields are ignored** — dashboard skips fields it doesn't recognize
5. **File size matters** — keep files under 1MB. `memory-recent.json` and `leads.json` can be larger
6. **UTF-8 encoding** — all files must be UTF-8 encoded
7. **No HTML in JSON values** — use markdown formatting in string fields if needed
