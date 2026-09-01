import { describe, expect, it } from "vitest";
import { POST as createSession } from "@/app/api/session/route";
import { GET as getSession } from "@/app/api/session/[id]/route";
import { POST as postItem } from "@/app/api/session/[id]/items/route";
import { GET as getSplit } from "@/app/api/session/[id]/split/route";
import { POST as postFinalize } from "@/app/api/session/[id]/finalize/route";

function withId(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postJson(path: string, body: unknown) {
  return new Request(`http://test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function newSession() {
  const res = await createSession();
  return res.json();
}

function fetchSession(id: string) {
  return getSession(new Request(`http://test/api/session/${id}`), withId(id));
}

function addItem(sessionId: string, body: unknown) {
  return postItem(postJson(`/api/session/${sessionId}/items`, body), withId(sessionId));
}

function fetchSplit(sessionId: string) {
  return getSplit(new Request(`http://test/api/session/${sessionId}/split`), withId(sessionId));
}

function finalize(sessionId: string, hostToken: string) {
  return postFinalize(postJson(`/api/session/${sessionId}/finalize`, { hostToken }), withId(sessionId));
}

describe("session lifecycle", () => {
  it("creates a session and can fetch it back by id", async () => {
    const created = await newSession();

    expect(created.id).toBeTruthy();
    expect(created.session.menu.length).toBeGreaterThan(0);

    const fetched = await (await fetchSession(created.id)).json();

    expect(fetched.id).toBe(created.id);
    expect(fetched.menu).toEqual(created.session.menu);
  });

  it("adds an item to a new participant's order", async () => {
    const created = await newSession();

    const addRes = await addItem(created.id, {
      name: "Alice",
      token: "alice-token",
      itemId: "burrito",
      qty: 2,
    });
    const order = await addRes.json();

    expect(addRes.status).toBe(200);
    expect(order.participants).toHaveLength(1);
    expect(order.participants[0]).toMatchObject({ name: "Alice" });
    expect(order.participants[0].lines[0]).toMatchObject({ itemId: "burrito", qty: 2 });
  });

  it("rejects an item id that isn't on the menu", async () => {
    const created = await newSession();

    const addRes = await addItem(created.id, {
      name: "Bob",
      token: "bob-token",
      itemId: "steak-dinner",
      qty: 1,
    });
    const body = await addRes.json();

    expect(addRes.status).toBe(400);
    expect(body.error).toMatch(/unknown menu item/i);
  });

  it("rejects a quantity outside the 1-10 range", async () => {
    const created = await newSession();

    const addRes = await addItem(created.id, {
      name: "Carol",
      token: "carol-token",
      itemId: "burrito",
      qty: 99,
    });
    const body = await addRes.json();

    expect(addRes.status).toBe(400);
    expect(body.error).toMatch(/quantity/i);
  });

  it("refuses to mutate an existing participant's order with the wrong token", async () => {
    const created = await newSession();

    await addItem(created.id, { name: "Dave", token: "daves-real-token", itemId: "burrito", qty: 1 });

    const spoofRes = await addItem(created.id, {
      name: "Dave",
      token: "an-attackers-guess",
      itemId: "taco-plate",
      qty: 1,
    });
    const body = await spoofRes.json();

    expect(spoofRes.status).toBe(403);
    expect(body.error).toMatch(/belongs to someone else/i);
  });

  it("computes each participant's total and an equal split across the group", async () => {
    const created = await newSession();

    // burrito = 9.5, taco-plate = 8
    await addItem(created.id, { name: "Eve", token: "eve-token", itemId: "burrito", qty: 2 }); // 19.00
    await addItem(created.id, { name: "Frank", token: "frank-token", itemId: "taco-plate", qty: 1 }); // 8.00

    const split = await (await fetchSplit(created.id)).json();

    expect(split.grandTotal).toBeCloseTo(27, 2);
    expect(split.equalShare).toBeCloseTo(13.5, 2);
    expect(split.perParticipant).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Eve", total: 19 }),
        expect.objectContaining({ name: "Frank", total: 8 }),
      ])
    );
  });

  it("rejects finalize with the wrong host token, then locks the order once finalized correctly", async () => {
    const created = await newSession();

    const wrongFinalize = await finalize(created.id, "not-the-host");
    expect(wrongFinalize.status).toBe(403);

    const rightFinalize = await finalize(created.id, created.hostToken);
    const finalized = await rightFinalize.json();
    expect(rightFinalize.status).toBe(200);
    expect(finalized.finalized).toBe(true);

    const addAfterFinalize = await addItem(created.id, {
      name: "Grace",
      token: "grace-token",
      itemId: "burrito",
      qty: 1,
    });
    const body = await addAfterFinalize.json();

    expect(addAfterFinalize.status).toBe(409);
    expect(body.error).toMatch(/finalized/i);
  });
});
