# Kitty

Everyone's AI agent adds their own items and allergies to one shared group order — Kitty tracks it live and splits the bill automatically, no manual collecting or spreadsheet math needed.

**Live:** https://kitty-1003427733440.asia-south1.run.app

Built for the [WebMCP Challenge](https://webmcp.devpost.com/). See [`PROJECT.md`](./PROJECT.md) for the full submission write-up, [`PLAN.md`](./PLAN.md) for the build plan, and [`TESTING.md`](./TESTING.md) for step-by-step testing instructions.

## How it works

1. A host opens `/` and clicks **Start a Kitty** — this creates a session and gives the host a link with a host token.
2. The host shares the plain session link (`/order/<id>`, no host token) with everyone else.
3. Each participant opens the link, picks their name, and opens the page in an agent-capable browser.
4. Everyone's own agent calls WebMCP tools registered on the page to add items, flag dietary restrictions, and check the split — scoped so each agent can only ever touch its own participant's order.
5. The host calls (or clicks) `finalize_order` to lock the cart.

## WebMCP tools registered

| Tool | Effect |
|---|---|
| `browse_menu` | List menu items with price + dietary tags |
| `add_item` | Add `{itemId, qty, notes}` to the calling participant's own order |
| `remove_item` | Remove one of the calling participant's own line items |
| `set_dietary_restriction` | Flag an allergy/restriction for the calling participant — cross-checked against the ordered items' menu tags, surfaced as a warning on the order board |
| `get_order_summary` | Return the full group order + running total |
| `split_bill` | Compute each participant's share of the total |
| `finalize_order` | Host-only — locks the order |

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

WebMCP is experimental — test the live app in **ChatGPT's in-app browser** (supports WebMCP out of the box) or **Google Chrome 149+** (enable `chrome://flags/#enable-webmcp-testing` and restart). See [`TESTING.md`](./TESTING.md) for the full walkthrough (host/guest setup, UI-only testing, agent-driven WebMCP testing, and a DevTools snippet for verifying tool registration directly). No credentials are required — Kitty has no login/auth.

## Architecture notes

- Next.js (App Router, TypeScript), deployed directly to **Cloud Run** (GCP) via `gcloud run deploy --source .` (source-based Buildpacks build, no Dockerfile).
- Session state is an **in-memory store** (`src/lib/kitty/store.ts`) — no database. This means the backend must run as a **single instance**, so it's deployed with `--min-instances=1 --max-instances=1`.
- Clients sync via polling (`GET /api/session/:id` every ~2s) rather than websockets, to keep the implementation small.
- Every mutating tool call is scoped server-side to the calling participant's identity (name + a per-participant token generated client-side on join), so one agent can never edit another participant's order. `finalize_order` requires a separate host token.
- The menu is a fixed allow-list (`src/lib/kitty/menu.ts`) — an agent can never invent an arbitrary priced item.
- `src/lib/kitty/conflicts.ts` cross-checks a participant's stated restrictions against the menu tags of what they've actually ordered (vegan/gluten/dairy substring matching), surfaced as a warning on the order board.

## Deploying

```bash
gcloud run deploy kitty \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=1
```

## License

MIT — see [`LICENSE`](./LICENSE).
