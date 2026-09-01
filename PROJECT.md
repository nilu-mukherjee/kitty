# Kitty

Everyone's AI agent adds their own items and allergies to one shared group order — Kitty tracks it live and splits the bill automatically, no manual collecting or spreadsheet math needed.

## Inspiration

Group orders always end the same way: one person becomes the unpaid dispatcher, allergies get missed, and the bill math takes longer than the meal did. We wanted agents to take over the boring parts — without losing what makes ordering together social.

## What it does

Kitty is a shared order page where everyone's own AI agent adds their items and dietary restrictions straight into one live cart via WebMCP tools — no forms, no relaying your order through one exhausted human. The host locks the order in, and Kitty splits the bill automatically.

## How we built it

Seven `document.modelContext.registerTool()` calls — `browse_menu`, `add_item`, `remove_item`, `set_dietary_restriction`, `get_order_summary`, `split_bill`, `finalize_order` — on a Next.js app deployed to Firebase App Hosting (GCP). Every mutating call is scoped server-side to the calling participant's identity, so an agent can only ever touch its own order. State lives in a lightweight in-memory session store, synced to every viewer with plain polling — no infrastructure we didn't need.

## Challenges we ran into

Letting several independent agents write to one shared cart *safely* was the real problem. WebMCP's tool boundaries had to double as both a UX contract and a security boundary — otherwise a confused or malicious agent could overwrite someone else's order or invent a priced item that doesn't exist on the menu.

## Accomplishments that we're proud of

Real multi-agent collaboration on one mutable session — not just one agent talking to one app — with guardrails (menu allow-lists, per-participant scoping, host-only finalize) tight enough we'd trust it with an actual office lunch order.

## What we learned

WebMCP tools aren't just an API surface — they're a trust boundary. The moment more than one agent can touch the same state, "what should this tool refuse to do" matters as much as "what should it do."

## What's next for Kitty

Itemized (not just equal) bill splitting, real restaurant menu imports, and letting a host's agent negotiate directly with a restaurant's own WebMCP tools once more storefronts expose them.

## Built with

**Language:** TypeScript, JavaScript

**Framework:** Next.js, React

**Platforms:** Web — deployed via Firebase App Hosting, tested via ChatGPT's in-app browser and Google Chrome 149+ (`chrome://flags/#enable-webmcp-testing`)

**Cloud services:** Google Cloud Platform — Firebase App Hosting, Cloud Run (hosting runtime), Firestore (fallback session store)

**Database:** In-memory session store, pinned to a single Cloud Run instance (no persistent DB by default — deliberately out of scope per the build plan; Firestore is the fallback if session persistence becomes necessary)

**API:** WebMCP (`document.modelContext.registerTool`), Next.js API routes (REST)
