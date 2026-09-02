"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findConflicts } from "@/lib/kitty/conflicts";

type MenuItem = { id: string; name: string; price: number; tags: string[] };
type OrderLine = { lineId: string; itemId: string; qty: number; notes?: string };
type ParticipantView = { name: string; lines: OrderLine[]; restrictions: string[] };
type SessionView = { id: string; finalized: boolean; menu: MenuItem[]; participants: ParticipantView[] };
type SplitView = {
  perParticipant: { name: string; total: number; restrictions: string[] }[];
  grandTotal: number;
  equalShare: number;
};
type Identity = { name: string; token: string };

const identityKey = (sessionId: string) => `kitty:${sessionId}:identity`;
const hostKey = (sessionId: string) => `kitty:${sessionId}:host`;

async function callApi(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function OrderClient({
  sessionId,
  hostTokenFromUrl,
}: {
  sessionId: string;
  hostTokenFromUrl: string | null;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [session, setSession] = useState<SessionView | null>(null);
  const [split, setSplit] = useState<SplitView | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const toolsRegistered = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(identityKey(sessionId));
    if (stored) setIdentity(JSON.parse(stored));
    if (hostTokenFromUrl) {
      localStorage.setItem(hostKey(sessionId), hostTokenFromUrl);
      setHostToken(hostTokenFromUrl);
    } else {
      const storedHost = localStorage.getItem(hostKey(sessionId));
      if (storedHost) setHostToken(storedHost);
    }
  }, [sessionId, hostTokenFromUrl]);

  const refresh = useCallback(async () => {
    try {
      const [sessionData, splitData] = await Promise.all([
        callApi(`/api/session/${sessionId}`),
        callApi(`/api/session/${sessionId}/split`),
      ]);
      setSession(sessionData);
      setSplit(splitData);
    } catch {
      // Session may not exist yet on the very first tick; ignore and retry.
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const joinSession = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newIdentity: Identity = { name: trimmed, token: crypto.randomUUID() };
    localStorage.setItem(identityKey(sessionId), JSON.stringify(newIdentity));
    setIdentity(newIdentity);
  };

  useEffect(() => {
    if (!identity || toolsRegistered.current) return;
    const modelContext = document.modelContext;
    if (!modelContext?.registerTool) {
      setMessage(
        "WebMCP isn't available in this browser. Open this page in ChatGPT's in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled."
      );
      return;
    }
    toolsRegistered.current = true;

    modelContext.registerTool({
      name: "browse_menu",
      description: "List the menu items available for this group order, including price and dietary tags.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => callApi("/api/menu"),
    });

    modelContext.registerTool({
      name: "add_item",
      description: `Add an item to ${identity.name}'s own order in this group order. This only ever affects ${identity.name}'s order, never anyone else's.`,
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Menu item id, from browse_menu" },
          qty: { type: "number", description: "Quantity, 1-10" },
          notes: { type: "string", description: "Optional note, e.g. 'no cilantro'" },
        },
        required: ["itemId", "qty"],
      },
      execute: async (input: { itemId: string; qty: number; notes?: string }) => {
        const order = await callApi(`/api/session/${sessionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: identity.name, token: identity.token, ...input }),
        });
        return { ok: true, order };
      },
    });

    modelContext.registerTool({
      name: "remove_item",
      description: `Remove an item from ${identity.name}'s own order.`,
      inputSchema: {
        type: "object",
        properties: { lineId: { type: "string", description: "Line item id to remove" } },
        required: ["lineId"],
      },
      execute: async (input: { lineId: string }) => {
        const order = await callApi(`/api/session/${sessionId}/items`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: identity.name, token: identity.token, ...input }),
        });
        return { ok: true, order };
      },
    });

    modelContext.registerTool({
      name: "set_dietary_restriction",
      description: `Flag a dietary restriction or allergy for ${identity.name}.`,
      inputSchema: {
        type: "object",
        properties: { restriction: { type: "string", description: "e.g. 'nut allergy', 'vegan'" } },
        required: ["restriction"],
      },
      execute: async (input: { restriction: string }) => {
        const order = await callApi(`/api/session/${sessionId}/restrictions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: identity.name, token: identity.token, ...input }),
        });
        return { ok: true, order };
      },
    });

    modelContext.registerTool({
      name: "get_order_summary",
      description: "Get the full group order: every participant's items, restrictions, and running total.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const [order, splitData] = await Promise.all([
          callApi(`/api/session/${sessionId}`),
          callApi(`/api/session/${sessionId}/split`),
        ]);
        return { order, split: splitData };
      },
    });

    modelContext.registerTool({
      name: "split_bill",
      description: "Compute each participant's share of the total bill for this group order.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => callApi(`/api/session/${sessionId}/split`),
    });

    if (hostToken) {
      modelContext.registerTool({
        name: "finalize_order",
        description: "Lock the group order so no one can add or remove items. Only the host can do this.",
        inputSchema: { type: "object", properties: {} },
        execute: async () =>
          callApi(`/api/session/${sessionId}/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hostToken }),
          }),
      });
    }
  }, [identity, hostToken, sessionId]);

  const finalize = async () => {
    if (!hostToken) return;
    try {
      await callApi(`/api/session/${sessionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not finalize");
    }
  };

  if (!identity) {
    return (
      <main className="wrap">
        <h1 id="join-heading">Join this Kitty</h1>
        <p id="join-hint">Pick a name — your agent will use it to add your own items to the order.</p>
        <label htmlFor="participant-name" className="sr-only">
          Your name
        </label>
        <input
          id="participant-name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Your name"
          aria-describedby="join-hint"
          onKeyDown={(e) => e.key === "Enter" && joinSession(nameInput)}
        />
        <button onClick={() => joinSession(nameInput)}>Join</button>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>🐱 Kitty — Order #{sessionId}</h1>
      <p>
        You&apos;re in as <strong>{identity.name}</strong>
        {hostToken ? " (host)" : ""}.
      </p>
      {message && <p className="notice">{message}</p>}
      {session?.finalized && <p className="notice">This order is finalized. No more changes.</p>}

      <section>
        <h2>Order</h2>
        {session && session.participants.length === 0 && (
          <p>No items yet — ask your agent to add something from the menu.</p>
        )}
        {session?.participants.map((p) => {
          const conflicts = findConflicts(p.restrictions, p.lines, session.menu);
          return (
            <div key={p.name} className="participant">
              <h3>
                {p.name}
                {p.restrictions.length > 0 && (
                  <span className="badges">
                    {p.restrictions.map((r) => (
                      <span key={r} className="badge">
                        {r}
                      </span>
                    ))}
                  </span>
                )}
              </h3>
              <ul>
                {p.lines.map((line) => {
                  const item = session.menu.find((m) => m.id === line.itemId);
                  return (
                    <li key={line.lineId}>
                      {line.qty}× {item?.name ?? line.itemId}
                      {line.notes ? ` — ${line.notes}` : ""} (${((item?.price ?? 0) * line.qty).toFixed(2)})
                    </li>
                  );
                })}
              </ul>
              {conflicts.length > 0 && (
                <p className="conflict">⚠ {conflicts.join("; ")}</p>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2>Menu</h2>
        <ul>
          {session?.menu.map((m) => (
            <li key={m.id}>
              {m.name} — ${m.price.toFixed(2)} <span className="tags">{m.tags.join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>

      {split && (
        <section>
          <h2>Split</h2>
          <p>
            Total: ${split.grandTotal.toFixed(2)} · Equal share: ${split.equalShare.toFixed(2)}/person
          </p>
          <ul>
            {split.perParticipant.map((p) => (
              <li key={p.name}>
                {p.name}: ${p.total.toFixed(2)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hostToken && !session?.finalized && <button onClick={finalize}>Finalize order</button>}

      <p className="hint">
        Invite others with this page&apos;s URL (drop the <code>host</code> parameter). Then ask your AI
        agent — in ChatGPT&apos;s in-app browser or Chrome with WebMCP enabled — to add items, flag
        allergies, or check the split.
      </p>
    </main>
  );
}
