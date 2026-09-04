# Testing Instructions

**Live URL:** https://kitty-1003427733440.asia-south1.run.app

**Credentials:** None required. Kitty has no login/auth — you join a session with just a display name. The only "tokens" involved are generated automatically in the URL when you create or join a session (see step 1 below), not something you need to obtain in advance.

## 1. Create a session (host)

1. Open the live URL.
2. Click **Start a Kitty**. This creates a session and redirects you to `/order/<id>?host=<host-token>` — keep this exact URL; the `host` token is what lets you finalize the order later. Don't share this URL with guests.
3. Copy the **plain** session link shown on the page (`/order/<id>`, no `host` param) — this is what you share with guests.

## 2. Join as a guest

1. Open the plain session link (`/order/<id>`) from step 1 — in a second browser, a private/incognito window, or a different device.
2. Enter a display name to join. This generates a per-participant token (stored client-side) that scopes which line items you're allowed to edit.

## 3. Test via the UI (no agent required)

With host and guest tabs open side by side:

- Browse the menu and add an item to your own order.
- Set a dietary restriction and confirm it's flagged if it conflicts with something you've ordered (e.g. mark "vegan" after ordering a menu item tagged dairy).
- Check the running total / split.
- As the host, click **Finalize** and confirm guests can no longer add items afterward.

## 4. Test via real WebMCP tool calls (agent-driven)

WebMCP is experimental and flag-gated. Use one of:

- **ChatGPT's in-app browser** — supports WebMCP out of the box.
- **Google Chrome 149+** — enable `chrome://flags/#enable-webmcp-testing` and restart the browser.

Steps:

1. Open the order page (host or guest link from steps 1–2) in the WebMCP-enabled browser/app and join with a name.
2. Ask your agent things like:
   - "Browse the menu."
   - "Add 2 burritos to my order, no onions."
   - "Flag that I have a nut allergy."
   - "What's the total, and how much does each person owe?"
   - (Host only) "Finalize the order."
3. Confirm the cart updates live for anyone else watching the same session, and that a guest agent's calls only ever touch that guest's own line items (try asking a guest's agent to edit another participant's order — it should be rejected).

Manual low-level check (DevTools console), useful for verifying tool registration directly:

```js
document.modelContext.getTools()
// should return all 7 tools, scoped/personalized to the joined participant

document.modelContext.executeTool(tool, JSON.stringify(args))
// pass the tool object from getTools(), not a name string; args must be JSON-stringified
```

## 5. Local setup (optional)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Same flow as above; local sessions are independent of the deployed live URL.
