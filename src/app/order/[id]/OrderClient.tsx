"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findConflicts } from "@/lib/kitty/conflicts";
import { MicButton } from "@/components/MicButton";
import type WaToast from "@awesome.me/webawesome/dist/components/toast/toast.js";

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
  const [showNameInput, setShowNameInput] = useState(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [split, setSplit] = useState<SplitView | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [restrictionInput, setRestrictionInput] = useState("");
  const [restrictionSubmitting, setRestrictionSubmitting] = useState(false);
  const [removingRestriction, setRemovingRestriction] = useState<string | null>(null);
  const [menuQty, setMenuQty] = useState<Record<string, number>>({});
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const toolsRegistered = useRef(false);
  const toastRef = useRef<WaToast>(null);
  const joiningNameRef = useRef<string | null>(null);
  const activitySnapshotRef = useRef<{
    participants: Record<string, { lineIds: Set<string>; restrictions: Set<string> }>;
    finalized: boolean;
  } | null>(null);

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

      const currentSnapshot = {
        participants: Object.fromEntries(
          sessionData.participants.map((participant: ParticipantView) => [participant.name, {
            lineIds: new Set(participant.lines.map((line) => line.lineId)),
            restrictions: new Set(participant.restrictions),
          }])
        ),
        finalized: sessionData.finalized,
      };
      const previousSnapshot = activitySnapshotRef.current;
      if (previousSnapshot) {
        const announce = (toast: string, spoken: string, icon = "bell") => {
          toastRef.current?.create(toast, { variant: "brand", icon, duration: 4000 });
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
          }
        };

        for (const name of Object.keys(previousSnapshot.participants)) {
          if (!currentSnapshot.participants[name] && name.toLowerCase() !== identity?.name.toLowerCase()) {
            announce(`${name} left your order`, `Hey, ${name} left the Kitty.`, "door-open");
          }
        }

        for (const participant of sessionData.participants) {
          const previous = previousSnapshot.participants[participant.name];
          const current = currentSnapshot.participants[participant.name];
          if (!previous) {
            const isCurrentBrowser = participant.name.toLowerCase() === identity?.name.toLowerCase()
              || participant.name.toLowerCase() === joiningNameRef.current?.toLowerCase();
            if (!isCurrentBrowser) {
              announce(`${participant.name} joined your order`, `Hey, your friend ${participant.name} joined the Kitty!`, "user");
            }
            continue;
          }
          for (const line of participant.lines) {
            if (!previous.lineIds.has(line.lineId)) {
              const item = sessionData.menu.find((menuItem: MenuItem) => menuItem.id === line.itemId);
              announce(
                `${participant.name} added ${line.qty} × ${item?.name ?? line.itemId}`,
                `${participant.name} added ${line.qty} ${item?.name ?? line.itemId} to the order`,
                "cart-plus"
              );
            }
          }
          for (const lineId of previous.lineIds) {
            if (!current.lineIds.has(lineId)) announce(`${participant.name} removed an item`, `${participant.name} removed an item from the order`, "trash");
          }
          for (const restriction of participant.restrictions) {
            if (!previous.restrictions.has(restriction)) announce(`${participant.name} flagged ${restriction}`, `${participant.name} flagged a ${restriction} restriction`, "flag");
          }
          for (const restriction of previous.restrictions) {
            if (!current.restrictions.has(restriction)) announce(`${participant.name} removed ${restriction}`, `${participant.name} removed the ${restriction} restriction`, "xmark");
          }
        }
        if (!previousSnapshot.finalized && currentSnapshot.finalized) {
          announce("Order finalized", "The Kitty order has been finalized", "check");
        }
      }
      activitySnapshotRef.current = currentSnapshot;
      setSession(sessionData);
      setSplit(splitData);
      setSessionLoaded(true);
    } catch {
      // Session may not exist yet on the very first tick; ignore and retry.
    }
  }, [identity, sessionId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const joinSession = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newIdentity: Identity = { name: trimmed, token: crypto.randomUUID() };
    joiningNameRef.current = trimmed;
    try {
      await callApi(`/api/session/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIdentity),
      });
      localStorage.setItem(identityKey(sessionId), JSON.stringify(newIdentity));
      setIdentity(newIdentity);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not join this Kitty");
    } finally {
      joiningNameRef.current = null;
    }
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
          itemId: {
            type: "string",
            enum: ["burrito", "taco-plate", "quesadilla", "salad-bowl", "chips-guac", "horchata"],
            description:
              "Exact menu item id: burrito, taco-plate, quesadilla, salad-bowl, chips-guac, or horchata. Use taco-plate when the user asks for Taco Plate.",
          },
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
        }) as SessionView;
        const addedItem = order.menu.find((item) => item.id === input.itemId);
        return {
          ok: true,
          added: {
            itemId: input.itemId,
            name: addedItem?.name ?? input.itemId,
            qty: input.qty,
            notes: input.notes,
            participant: identity.name,
          },
          order,
        };
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

  const submitRestriction = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !identity) return;
    setRestrictionSubmitting(true);
    try {
      await callApi(`/api/session/${sessionId}/restrictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: identity.name, token: identity.token, restriction: trimmed }),
      });
      setRestrictionInput("");
      refresh();
      toastRef.current?.create(`Flagged "${trimmed}" for ${identity.name}`, {
        variant: "danger",
        icon: "flag",
        duration: 4000,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save restriction");
    } finally {
      setRestrictionSubmitting(false);
    }
  };

  const deleteRestriction = async (restriction: string) => {
    if (!identity) return;
    setRemovingRestriction(restriction);
    try {
      await callApi(`/api/session/${sessionId}/restrictions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: identity.name, token: identity.token, restriction }),
      });
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove restriction");
    } finally {
      setRemovingRestriction(null);
    }
  };

  const copyInviteUrl = async () => {
    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.delete("host");

    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      toastRef.current?.create("Invite URL copied", {
        variant: "success",
        icon: "check",
        duration: 3000,
      });
    } catch {
      setMessage("Could not copy the invite URL. Please copy it from your browser's address bar.");
    }
  };

  const leaveKitty = async () => {
    if (!identity || hostToken) return;
    try {
      await callApi(`/api/session/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(identity),
      });
      localStorage.removeItem(identityKey(sessionId));
      setIdentity(null);
      toastRef.current?.create("You left the Kitty", { variant: "success", icon: "door-open", duration: 3000 });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not leave this Kitty");
    }
  };

  const getQty = (itemId: string) => menuQty[itemId] ?? 1;
  const setQty = (itemId: string, qty: number) => {
    const clamped = Math.min(10, Math.max(1, Math.round(qty) || 1));
    setMenuQty((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const addToCart = async (itemId: string) => {
    if (!identity) return;
    setAddingItemId(itemId);
    try {
      await callApi(`/api/session/${sessionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: identity.name, token: identity.token, itemId, qty: getQty(itemId) }),
      });
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setAddingItemId(null);
    }
  };

  const removeLine = async (lineId: string) => {
    if (!identity) return;
    setRemovingLineId(lineId);
    try {
      await callApi(`/api/session/${sessionId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: identity.name, token: identity.token, lineId }),
      });
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove item");
    } finally {
      setRemovingLineId(null);
    }
  };

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
        <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical" with-header={false}>
          <div className="mascot" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="88" height="88">
              <polygon points="24,40 40,10 52,42" fill="#f2a65a" />
              <polygon points="96,40 80,10 68,42" fill="#f2a65a" />
              <polygon points="30,36 40,18 48,38" fill="#c97a34" />
              <polygon points="90,36 80,18 72,38" fill="#c97a34" />
              <ellipse cx="60" cy="70" rx="42" ry="38" fill="#f2a65a" />
              <circle className="mascot-eye" cx="44" cy="66" r="6" fill="#171717" />
              <circle className="mascot-eye" cx="76" cy="66" r="6" fill="#171717" />
              <path d="M52 84 Q60 92 68 84" stroke="#171717" strokeWidth="3" fill="none" strokeLinecap="round" />
              <line x1="20" y1="76" x2="40" y2="80" stroke="#c97a34" strokeWidth="2" />
              <line x1="20" y1="86" x2="40" y2="86" stroke="#c97a34" strokeWidth="2" />
              <line x1="100" y1="76" x2="80" y2="80" stroke="#c97a34" strokeWidth="2" />
              <line x1="100" y1="86" x2="80" y2="86" stroke="#c97a34" strokeWidth="2" />
            </svg>
            <p className="mascot-bubble">Hi, I&apos;m Kitty! What should I call you?</p>
          </div>
          <h1 id="join-heading">Join this Kitty</h1>
          <p id="join-hint">Pick a name — your agent will use it to add your own items to the order.</p>
          {!showNameInput ? (
            <div className="home-actions">
              <wa-button suppressHydrationWarning className="start-kitty-btn" variant="brand" appearance="filled" onClick={() => setShowNameInput(true)}>
                <wa-icon suppressHydrationWarning canvas="fixed" slot="start" name="keyboard"></wa-icon>
                <span>Join by input</span>
              </wa-button>
              <MicButton 
                label="your name" 
                variant="brand"
                appearance="filled"
                className=""
                onResult={(t) => {
                  setNameInput(t);
                  joinSession(t);
                }}
                                  >
                Join by voice
              </MicButton>
            </div>
          ) : (
            <>
              <wa-input suppressHydrationWarning
                id="participant-name"
                label="Your name"
                value={nameInput}
                onInput={(e) => setNameInput((e.target as HTMLInputElement).value)}
                placeholder="Type your name"
                onKeyDown={(e) => e.key === "Enter" && joinSession(nameInput)}
                autofocus
              ></wa-input>
              <div className="home-actions" style={{ marginTop: "var(--wa-space-s)" }}>
                <wa-button suppressHydrationWarning className="start-kitty-btn" variant="brand" appearance="filled" onClick={() => joinSession(nameInput)}>
                  Join
                </wa-button>
                <wa-button suppressHydrationWarning variant="neutral" appearance="plain" onClick={() => setShowNameInput(false)}>
                  Cancel
                </wa-button>
              </div>
            </>
          )}
        </wa-card>
      </main>
    );
  }

  const hasItems = !!session?.participants.some((p) => p.lines.length > 0);
  const currentRestrictions = session?.participants.find((p) => p.name === identity.name)?.restrictions ?? [];
  const hasRestrictions = currentRestrictions.length > 0;
  const showRightSidebar = (split && hasItems) || hasRestrictions;
  const restrictionEditor = !session?.finalized ? (
    <wa-details suppressHydrationWarning appearance="filled-outlined" className="restriction-details">
      <span slot="summary" className="restriction-details-summary">
        <wa-icon suppressHydrationWarning name="flag"></wa-icon>
        Add dietary restriction
      </span>
      <div className="restriction-details-content">
        <p>Share an allergy or dietary need so everyone ordering can keep it in mind.</p>
        <div className="restriction-form-row">
          <wa-input suppressHydrationWarning
            id="restriction-input"
            label="Dietary restriction or allergy"
            value={restrictionInput}
            onInput={(e) => setRestrictionInput((e.target as HTMLInputElement).value)}
            placeholder="e.g. nut allergy"
            onKeyDown={(e) => e.key === "Enter" && submitRestriction(restrictionInput)}
          ></wa-input>
        </div>
        <wa-button suppressHydrationWarning
          variant="danger"
          appearance="filled"
          onClick={() => submitRestriction(restrictionInput)}
          disabled={restrictionSubmitting}
          loading={restrictionSubmitting}
                                  >
          Add restriction
        </wa-button>
      </div>
    </wa-details>
  ) : null;

  return (
    <main className="wrap wrap-wide">
      <wa-toast suppressHydrationWarning ref={(el: WaToast) => { toastRef.current = el; }}></wa-toast>
      <h1>🐱 Kitty — Order #{sessionId}</h1>
      <p>
        You&apos;re in as <strong>{identity.name}</strong>
        {hostToken ? " (host)" : ""}.
      </p>

      <div className="intro-row">
        {session && !session.finalized && (
          <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical" with-header className="try-asking">
            <div slot="header">
              <wa-icon suppressHydrationWarning name="comment"></wa-icon>
              Try asking your agent
            </div>
            <ul>
              <li>&ldquo;Add a {session.menu[0]?.name.toLowerCase()} to my order&rdquo;</li>
              <li>&ldquo;I have a nut allergy&rdquo;</li>
              <li>&ldquo;What&apos;s the total, and what do I owe?&rdquo;</li>
              {hostToken && <li>&ldquo;Finalize the order&rdquo;</li>}
            </ul>
          </wa-card>
        )}

        <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical" with-header className="try-asking note-card">
          <div slot="header">
            <wa-icon suppressHydrationWarning name="circle-info"></wa-icon>
            NOTE
          </div>
          <p>
            Ordering with friends? Copy the invite link and share it with your group. They can join the
            order, add their own items, and share dietary restrictions without accessing your host controls.
          </p>
          <wa-button suppressHydrationWarning variant="brand" appearance="filled" onClick={copyInviteUrl}>
            <wa-icon suppressHydrationWarning slot="start" name="copy"></wa-icon>
            Copy invite URL
          </wa-button>
        </wa-card>
      </div>

      {message && (
        <wa-callout suppressHydrationWarning variant="warning">
          <wa-icon suppressHydrationWarning slot="icon" name="triangle-exclamation"></wa-icon>
          {message}
        </wa-callout>
      )}
      {session?.finalized && (
        <wa-callout suppressHydrationWarning variant="neutral">
          <wa-icon suppressHydrationWarning slot="icon" name="lock"></wa-icon>
          This order is finalized. No more changes.
        </wa-callout>
      )}

      {!hostToken && session && (
        <div className="leave-kitty-row">
          <wa-button suppressHydrationWarning appearance="filled" variant="warning" size="small" className="leave-kitty-button" onClick={leaveKitty}>
            <wa-icon suppressHydrationWarning slot="start" name="door-open"></wa-icon>
            Leave Kitty
          </wa-button>
        </div>
      )}

      <div className={`layout${showRightSidebar ? " layout-with-right-sidebar" : ""}`}>
        <div className="layout-main">
          <wa-card suppressHydrationWarning appearance="outlined" with-header className="menu-list-card">
            <div slot="header">
              <wa-icon suppressHydrationWarning name="utensils"></wa-icon>
              Menu
            </div>
            <div className="menu-list">
              {session?.menu.map((m) => (
                <div key={m.id} className="menu-item-row">
                  <div className="menu-item-info">
                    <span className="menu-item-name">{m.name}</span>
                    {m.tags && m.tags.length > 0 && (
                      <div className="menu-item-tags">
                        {m.tags.map((t) => (
                          <wa-badge suppressHydrationWarning key={t} variant="brand" appearance="filled">
                            <wa-icon suppressHydrationWarning slot="start" name="tag"></wa-icon>
                            {t}
                          </wa-badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="menu-item-actions">
                    <span className="menu-item-price">
                      ${m.price.toFixed(2)}
                    </span>
                    <wa-input suppressHydrationWarning
                      type="number"
                      min="1" max="10" step={1}
                      className="qty-input"
                      value={String(menuQty[m.id] || 1)}
                      onInput={(e) => {
                        const val = parseInt((e.target as HTMLInputElement).value, 10);
                        if (!isNaN(val)) setQty(m.id, val);
                      }}
                    ></wa-input>
                    <wa-button suppressHydrationWarning
                      variant="brand"
                      appearance="filled"
                      onClick={() => addToCart(m.id)}
                      disabled={session?.finalized || addingItemId === m.id}
                      loading={addingItemId === m.id}
                      className="add-to-cart-btn"
                                  >
                      Add to cart
                    </wa-button>
                  </div>
                </div>
              ))}
            </div>
          </wa-card>
        </div>

        <aside className="layout-sidebar">
          <section>
            {!sessionLoaded && (
              <div className="skeleton-stack">
                <wa-skeleton suppressHydrationWarning effect="sheen"></wa-skeleton>
                <wa-skeleton suppressHydrationWarning effect="sheen"></wa-skeleton>
                <wa-skeleton suppressHydrationWarning effect="sheen"></wa-skeleton>
              </div>
            )}
            {sessionLoaded && session && (() => {
              const others = session.participants.filter((p) => p.name !== identity.name);
              const me = session.participants.find((p) => p.name === identity.name) ?? {
                name: identity.name,
                lines: [],
                restrictions: [],
              };
              return [me, ...others];
            })().map((p) => {
              return (
                <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical" key={p.name} with-header className={`participant cart${p.name === identity.name ? " own-cart" : ""}`}>
                  <div slot="header" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wa-space-xs)" }}>
                      <wa-icon suppressHydrationWarning name="cart-shopping"></wa-icon>
                      {p.name === identity.name ? "Your order" : `${p.name}'s order`}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wa-space-xs)" }}>
                      {!sessionLoaded && <wa-spinner suppressHydrationWarning></wa-spinner>}
                    </div>
                  </div>
                  <ul className="cart-lines">
                    {p.lines.length === 0 && (
                      <li className="cart-line-empty">No items yet — add something from the menu, or ask your agent to.</li>
                    )}
                    {p.lines.map((line) => {
                      const item = session.menu.find((m) => m.id === line.itemId);
                      const lineConflicts = findConflicts(p.restrictions, [line], session.menu);
                      const conflictIndicatorId = `conflict-indicator-${line.lineId}`;
                      return (
                        <li key={line.lineId} className="cart-line">
                          <div className="cart-line-details">
                            <div className="cart-line-summary">
                              <span className="cart-line-main">
                                <span className="cart-line-indicator">
                                  {lineConflicts.length > 0 && (
                                    <>
                                      <wa-badge
                                        suppressHydrationWarning
                                        id={conflictIndicatorId}
                                        variant="warning"
                                        pill
                                        attention="pulse"
                                        className="cart-line-warning-badge"
                                        aria-label={lineConflicts.join("; ")}
                                      ></wa-badge>
                                      <wa-tooltip suppressHydrationWarning for={conflictIndicatorId}>
                                        {lineConflicts.join("; ")}
                                      </wa-tooltip>
                                    </>
                                  )}
                                </span>
                                <wa-badge suppressHydrationWarning variant="brand" pill appearance="filled" className="cart-line-quantity">
                                  {line.qty}×
                                </wa-badge>
                                <span className="cart-line-name">{item?.name ?? line.itemId}</span>
                                {line.notes && <span className="cart-line-notes">{line.notes}</span>}
                              </span>
                              <span className="cart-line-price">
                                ${((item?.price ?? 0) * line.qty).toFixed(2)}
                              </span>
                              {p.name === identity.name && !session?.finalized && (
                                <>
                                  <wa-button suppressHydrationWarning
                                    id={`remove-${line.lineId}`}
                                    appearance="plain"
                                    variant="danger"
                                    className="cart-line-remove"
                                    onClick={() => removeLine(line.lineId)}
                                    disabled={removingLineId === line.lineId}
                                    aria-label={`Remove ${item?.name ?? line.itemId} from your order`}
                                  >
                                    <wa-icon suppressHydrationWarning name="trash"></wa-icon>
                                  </wa-button>
                                  <wa-tooltip suppressHydrationWarning for={`remove-${line.lineId}`}>Remove from order</wa-tooltip>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {split && (
                    <div className="cart-summary">
                      <div className="cart-summary-row cart-summary-total">
                        <span>Total</span>
                        <span>${split.grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="cart-summary-row">
                        <span>Equal share</span>
                        <span>${split.equalShare.toFixed(2)}/person</span>
                      </div>
                    </div>
                  )}
                  {p.name === identity.name && restrictionEditor}
                </wa-card>
              );
            })}
          </section>

          {hostToken && !session?.finalized && hasItems && (
            <wa-button suppressHydrationWarning variant="brand" appearance="filled" className="finalize-button" onClick={finalize}>
              Finalize order
            </wa-button>
          )}
        </aside>

        {showRightSidebar && (
          <aside className="right-sidebar">
            {hasRestrictions && (
              <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical" with-header className="participant restrictions-card">
                <div slot="header">
                  <wa-icon suppressHydrationWarning name="clipboard-check"></wa-icon>
                  Restrictions
                </div>
                <ul className="restriction-checklist">
                  {currentRestrictions.map((restriction) => (
                    <li key={restriction}>
                      <span className="restriction-checklist-label">
                        <wa-icon suppressHydrationWarning name="check"></wa-icon>
                        <span>{restriction}</span>
                      </span>
                      {!session?.finalized && (
                        <wa-button suppressHydrationWarning
                          appearance="plain"
                          variant="danger"
                          size="small"
                          className="restriction-remove"
                          onClick={() => deleteRestriction(restriction)}
                          disabled={removingRestriction === restriction}
                          loading={removingRestriction === restriction}
                          aria-label={`Remove ${restriction} restriction`}
                        >
                          <wa-icon suppressHydrationWarning name="xmark"></wa-icon>
                        </wa-button>
                      )}
                    </li>
                  ))}
                </ul>
              </wa-card>
            )}

            {split && hasItems && (
              <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical" with-header className="participant split-card">
                <div slot="header">
                  <wa-icon suppressHydrationWarning name="percent"></wa-icon>
                  Split
                </div>
                <ul className="split-list">
                  {split.perParticipant.map((p) => (
                    <li key={p.name}>
                      <span>{p.name}</span>
                      <span className="split-amount">${p.total.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </wa-card>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
