# DEBUGGING-PROCESS.md — 5-Step Systematic Process

**MANDATORY for ALL troubleshooting, debugging, errors, and bugs.**
Never skip steps. Never claim "fixed" without clean QA results.

---

## Step 1: DIAGNOSE
- What exactly is broken? Get the actual error, not a guess.
- When did it last work? What changed since then?
- Reproduce the issue. If you can't reproduce it, you don't understand it.
- Check logs, check state, check config. Read before you fix.

## Step 2: DESIGN SOLUTION
- What's the root cause? (Not the symptom — the cause.)
- What are the options to fix it? List at least 2.
- What could go wrong with each option?
- Pick the safest option that actually solves the root cause.

## Step 3: IMPLEMENT
- Make the change. One change at a time.
- Document what you changed and why.
- If it's a config change, back up the original first.

## Step 4: QA / DRY RUN
- Test the fix with real data, not assumptions.
- Check the actual output, not just "no errors."
- If it's a recurring issue, verify it doesn't come back.
- If QA fails → go back to Step 2. Do NOT push forward.

## Step 5: CONFIRM WITH PROOF
- Show the clean result. Screenshot, log output, or data.
- Only THEN declare it fixed.
- Update ERRORS.md with what happened and the rule to prevent recurrence.
- Update memory/daily/ with the fix details.

---

**If you find yourself "trying things" without a diagnosis → STOP. Go back to Step 1.**
**If QA fails → loop back to Step 2 and redesign. Do NOT keep patching.**
