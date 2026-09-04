# Kitty — WebMCP Challenge Build Plan

> Project name: **Kitty** — British slang for a shared pool of money, ties directly to the bill-splitting mechanic.

## 1. Deadline reality check

Submission Period closes **Sept 3, 2026 @ 1:00 PM PT**. Correction to an earlier note in this file: the Devpost overview page's **Sept 4, 2026 @ 1:30 AM GMT+5:30** is not a separate/conflicting deadline — it's the *same instant*, just shown in the viewer's local timezone. So there's a bit more runway than "one working day" implied (roughly two days from when this build started), but the scope below stays deliberately trimmed anyway — no auth system, no payments, no websockets, no multi-tenant infra — since that scope was the right call regardless of the exact hour count.

## 2. The idea

**Problem:** Coordinating a group order (office lunch, party snacks, potluck) is annoying — one person manually collects everyone's order via Slack/text, re-types it into a cart, tracks allergies by memory, and does the math on who owes what.

**Pitch:** A shared order page where **each participant's own AI agent** adds their items directly to a live shared cart via WebMCP tools — no forms, no re-explaining context to a human collector. The host finalizes and the app computes the split automatically.

**Why this fits WebMCP specifically (not just "an app with AI"):**
- Multiple independent agents (one per participant) call tools against **one shared mutable session** — this is qualitatively different from the single-user storefront patterns in the challenge's own example resources.
- It directly answers the required submission question "what can people and agents do together that was difficult or impossible before": today, an agent can't safely modify a *shared* cart it doesn't own without a defined tool contract — WebMCP's tool boundaries make that safe (each agent can only touch its own participant's line items).

## 3. WebMCP tools to register

All registered client-side via `document.modelContext.registerTool()` on the shared order page.

| Tool | Purpose | Notes |
|---|---|---|
| `browse_menu` | List available items with price + dietary tags | Read-only, no auth needed |
| `add_item` | Add `{item, qty, notes}` to the calling participant's own order | Server validates item exists in menu allow-list |
| `remove_item` | Remove a line item from the calling participant's own order | Cannot touch another participant's items |
| `set_dietary_restriction` | Flag an allergy/restriction for the calling participant | Cross-checked against menu tags, surfaced as a UI badge |
| `get_order_summary` | Return the full group order + running total | Read-only |
| `split_bill` | Compute per-person share (equal or itemized), optionally with tax/tip | Pure computation over current session state |
| `finalize_order` | Lock the order so no further `add_item`/`remove_item` succeeds | Host-only, gated by a host token |

Each participant identifies themselves once (name only, no auth) when joining the session URL; that identity scopes which line items their agent's tool calls can mutate.

## 4. Architecture

- **Framework:** Next.js, deployed directly to **Cloud Run** (GCP) via `gcloud run deploy --source .` (source-based Buildpacks build — no Dockerfile needed). Firebase App Hosting's GitHub-connected flow was the original plan, but it needs an interactive GitHub App install; a direct `gcloud` deploy is fully scriptable and lands on the same underlying service.
- **Isolation:** Deployed as its own Cloud Run service (`kitty`) in the `fixmycity-506122` project, alongside two unrelated pre-existing services (`fixmycity`, `fixmycity-events`). Separate service name, separate revision history, separate URL — nothing shared with those services. No Firestore database exists in the project yet; if Kitty ever needs one, it gets its own separately-named database, never a shared/default one.
- **State:** One in-memory session object per order (`Map<sessionId, OrderState>`), pinned to a single Cloud Run instance (see below). Firestore is the fallback if in-memory proves unreliable.
- **Sync:** Client polling every ~2s against a `GET /api/session/:id` route. Skip websockets/SSE — not worth the risk this close to deadline.
- **Identity:** Session-scoped participant name stored in `localStorage`/query param, passed with every tool call so the server can enforce "you can only edit your own items."
- **Host control:** Host gets a token in the URL when creating the session; `finalize_order` requires it.

> **GCP-specific gotcha:** Cloud Run can scale to multiple stateless instances — an in-memory `Map` won't be shared across them. Deployed with `--min-instances=1 --max-instances=1` so the in-memory store stays valid. Verified in production: a session created in one request was correctly read back in a separate follow-up request. If reliability becomes a problem at higher traffic, swap to **Firestore** for session state (own named database, not shared with anything else in the project).

**Live URL:** https://kitty-1003427733440.asia-south1.run.app

## 5. Guardrails (per WebMCP's own tool-security guidance)

- Validate all `add_item` calls against a fixed menu allow-list — never let an agent-supplied string become an arbitrary priced item.
- Cap quantity per call (e.g. max 10) to avoid runaway/malicious tool calls.
- Treat the free-text `notes` field as untrusted display text — escape it before rendering, never eval/interpret it.
- Scope every mutating tool call to the calling participant's own identity server-side, not just client-side.
- `finalize_order` requires the host token; all other tools are open to any session participant.

## 6. Build sequence (~1 day, with buffer)

| Phase | Time | Output |
|---|---|---|
| 1. Scaffold + deploy skeleton | 1h | Next.js app live on Cloud Run immediately — get a real URL working before building features |
| 2. Session data model + API routes | 1.5h | `create session`, `get session`, `add/remove item`, `set restriction`, `finalize` |
| 3. Register WebMCP tools | 2h | All 7 tools wired to API routes; test each in Chrome DevTools' WebMCP tool inspector |
| 4. UI | 2h | Join flow, live cart grouped by participant, dietary badges, running total, finalize button |
| 5. Guardrails + polish | 1h | Menu allow-list validation, host token check, error states, mobile-friendly layout |
| 6. Content | 1.5h | README, MIT license visible in repo "About", submission text description, script + record <3 min demo video |
| 7. Submit | 0.5h | Devpost form: live URL, repo URL, video link, description |

Total: ~9.5h — leaves slack against a full working day.

## 7. Demo video plan (<3 minutes, script it before recording)

**Setup before recording:** open the live URL (https://kitty-1003427733440.asia-south1.run.app), click **Start a Kitty**, and keep the resulting `?host=...` URL handy for one browser profile/tab (the host); open the plain `/order/<id>` URL (no `host` param) in a second profile/tab or ChatGPT's in-app browser (the guest). Both need WebMCP enabled — see the checklist item above.

1. **(0:00–0:20) Problem statement.** "Group orders are annoying to coordinate — someone has to manually collect everyone's order, remember allergies, and do the bill math."
2. **(0:20–1:30) Two people, two agents, one cart.** As the host, ask your agent something like:
   > "Add 2 burritos to my order, no onions."

   Then, in the guest tab/profile, ask that agent:
   > "Check the menu, then add a taco plate for me, and flag that I have a nut allergy."

   Show both browser windows side by side — the cart updates live in both as each agent's `add_item`/`set_dietary_restriction` calls land.
3. **(1:30–2:10) Split and finalize.** Ask either agent: *"What's the total, and how much does each person owe?"* (shows `split_bill`). Then, as the host, ask: *"Finalize the order."* (shows `finalize_order`, and that a guest agent can no longer add items afterward — worth demonstrating by trying and showing the rejection).
4. **(2:10–2:45) How WebMCP was used.** Name the 7 tools briefly and mention the guardrail that matters most for judges: each tool call is scoped server-side to the calling participant's identity, so one agent can never edit another's order, and the menu is a fixed allow-list so an agent can't invent a priced item.
5. Audio narration required throughout — no silent screen capture. Upload publicly to YouTube and paste the link into `PROJECT.md` and the Devpost submission form.

## 8. Submission checklist

- [x] Live URL works — https://kitty-1003427733440.asia-south1.run.app deployed; full flow (create/join/add/restriction/split/finalize) verified via curl against prod, via the UI in a real Chrome browser, **and via real WebMCP tool calls**: with `chrome://flags/#enable-webmcp-testing` enabled, `document.modelContext.getTools()` returned all 7 correctly-scoped tools (descriptions personalized to the joined participant's name), and `document.modelContext.executeTool(tool, JSON.stringify(args))` actually executed `add_item` end-to-end — the order updated with the real item, notes, and price. **Key finding for the demo/any future debugging:** Chrome's native `executeTool` takes the tool object from `getTools()` (not a name string) and wants its arguments JSON-stringified, not passed as a raw object — `executeTool(tool, JSON.stringify(args))`, not `executeTool('name', args)`.
- [x] Public repo (GitHub/GitLab/Bitbucket) with all source + setup instructions — https://github.com/nilu-mukherjee/kitty
- [x] Open-source license file (MIT recommended), visible in the repo's "About" section — confirmed via GitHub API: `license.spdx_id: "MIT"`, plus description/homepage/topics set on the repo
- [x] Repo demonstrates real `document.modelContext.registerTool(...)` usage (per required snippet) — `src/app/order/[id]/OrderClient.tsx`, all 7 tools
- [ ] Text description covers: WebMCP fit, UX improvement, what's newly possible, implementation summary — drafted in `PROJECT.md`; good enough to submit as-is, optionally tighten after your manual WebMCP-browser check above
- [ ] <3 min demo video, public on YouTube, with audio, no third-party trademarked/copyrighted material — **needs you**; see Section 7 for the shot list
- [x] Automated tests for the 7 core behaviors + malformed-input handling (`npm test`, 8 tests) — session lifecycle, add/remove scoping, menu allow-list, quantity cap, identity spoofing rejection, split math, host-only finalize + post-finalize lock, malformed JSON → 400
- [x] Confirm project name is specific (not AI-generic) before final submit — **Kitty**

## 9. Recent implementation updates (Sept 4, 2026)

- Responsive three-column desktop layout: Menu, participant orders, and a right-hand utility column. The utility column places **Restrictions first, then Split**; narrower screens fall back to a non-overflowing two-column/stacked layout.
- Participant order cards no longer use `<wa-details>` for cart lines, keeping item details visible. The dietary-restriction editor remains collapsible with `<wa-details>`.
- Added a warm yellow/orange **Leave Kitty** button for non-host participants. Leaving removes that participant, their items, and restrictions from the shared session; hosts do not see the control.
- Joining now registers the participant server-side immediately after a name is chosen, so their order card and participant name are visible before they add food.
- Added a **Copy invite URL** button. It removes the private `host` query parameter before copying so guests can safely share the link.
- Improved NOTE copy to explain sharing in plain language and include the invite action.
- Dietary conflict indicators have a pointer cursor and only appear for actual incompatibilities (for example, a vegan restriction on a non-vegan item; Salad Bowl is correctly treated as vegan-safe).
- WebMCP `add_item` now restricts `itemId` to the known menu allow-list and returns the exact server-resolved item name, quantity, and participant to prevent mismatched confirmations.
- Added activity announcements using the existing refresh cycle: participant joined/left, item added/removed, restriction added/removed, and order finalized. Each event appears as a toast and is spoken by the browser; initial state and the current browser's own join/leave events are silent.

## 10. Risks

- **WebMCP is flag-gated/experimental** — test in real Chrome 149+ or ChatGPT's in-app browser well before recording; don't assume it works from code alone.
- **Multi-agent demo logistics** — recording two agents acting on one shared session needs two browser profiles or ChatGPT app + Chrome side by side; rehearse this once before the real take.
- **Scope creep** — resist adding payments, real restaurant integrations, or auth. The 7 tools above are enough to show non-trivial WebMCP leverage.
- **In-memory state on Cloud Run** — mitigated via `--min-instances=1 --max-instances=1` and verified with a cross-request curl test in production. Still worth a quick two-browser check before recording the demo, since sustained concurrent traffic hasn't been load-tested.
