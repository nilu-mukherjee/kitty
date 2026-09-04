import { randomUUID } from "crypto";
import { MENU } from "./menu";
import type { OrderLine, OrderSession, Participant } from "./types";

const MAX_QTY_PER_LINE = 10;
const MAX_NOTE_LENGTH = 200;
const MAX_RESTRICTION_LENGTH = 60;

const globalStore = globalThis as unknown as { __kittySessions?: Map<string, OrderSession> };
const sessions = globalStore.__kittySessions ?? new Map<string, OrderSession>();
globalStore.__kittySessions = sessions;

export class KittyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createSession(): OrderSession {
  const session: OrderSession = {
    id: randomUUID().slice(0, 8),
    hostToken: randomUUID(),
    finalized: false,
    createdAt: Date.now(),
    participants: {},
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): OrderSession {
  const session = sessions.get(id);
  if (!session) throw new KittyError("Session not found", 404);
  return session;
}

function getOrCreateParticipant(session: OrderSession, name: string, token: string): Participant {
  const key = name.trim().toLowerCase();
  if (!key) throw new KittyError("Name is required");
  const existing = session.participants[key];
  if (existing) {
    if (existing.token !== token) {
      throw new KittyError("This name belongs to someone else in this session", 403);
    }
    return existing;
  }
  const participant: Participant = { name: name.trim(), token, lines: [], restrictions: [] };
  session.participants[key] = participant;
  return participant;
}

export function joinParticipant(sessionId: string, name: string, token: string): OrderSession {
  const session = getSession(sessionId);
  if (session.finalized) throw new KittyError("This order has been finalized", 409);
  getOrCreateParticipant(session, name, token);
  return session;
}

export function leaveParticipant(sessionId: string, name: string, token: string): OrderSession {
  const session = getSession(sessionId);
  if (session.finalized) throw new KittyError("This order has been finalized", 409);
  const key = name.trim().toLowerCase();
  const participant = session.participants[key];
  if (!participant) throw new KittyError("Participant not found", 404);
  if (participant.token !== token) throw new KittyError("This name belongs to someone else in this session", 403);
  delete session.participants[key];
  return session;
}

export function addItem(
  sessionId: string,
  name: string,
  token: string,
  itemId: string,
  qty: number,
  notes?: string
): OrderSession {
  const session = getSession(sessionId);
  if (session.finalized) throw new KittyError("This order has been finalized", 409);
  const menuItem = MENU.find((m) => m.id === itemId);
  if (!menuItem) throw new KittyError(`Unknown menu item: ${itemId}`);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
    throw new KittyError(`Quantity must be a whole number between 1 and ${MAX_QTY_PER_LINE}`);
  }
  const participant = getOrCreateParticipant(session, name, token);
  const line: OrderLine = {
    lineId: randomUUID().slice(0, 8),
    itemId,
    qty,
    notes: notes?.slice(0, MAX_NOTE_LENGTH),
  };
  participant.lines.push(line);
  return session;
}

export function removeItem(sessionId: string, name: string, token: string, lineId: string): OrderSession {
  const session = getSession(sessionId);
  if (session.finalized) throw new KittyError("This order has been finalized", 409);
  const key = name.trim().toLowerCase();
  const participant = session.participants[key];
  if (!participant) throw new KittyError("Participant not found", 404);
  if (participant.token !== token) throw new KittyError("This name belongs to someone else in this session", 403);
  const before = participant.lines.length;
  participant.lines = participant.lines.filter((l) => l.lineId !== lineId);
  if (participant.lines.length === before) throw new KittyError("Line item not found", 404);
  return session;
}

export function setRestriction(sessionId: string, name: string, token: string, restriction: string): OrderSession {
  const session = getSession(sessionId);
  const participant = getOrCreateParticipant(session, name, token);
  const clean = restriction.trim().slice(0, MAX_RESTRICTION_LENGTH);
  if (clean && !participant.restrictions.includes(clean)) {
    participant.restrictions.push(clean);
  }
  return session;
}

export function removeRestriction(sessionId: string, name: string, token: string, restriction: string): OrderSession {
  const session = getSession(sessionId);
  if (session.finalized) throw new KittyError("This order has been finalized", 409);
  const key = name.trim().toLowerCase();
  const participant = session.participants[key];
  if (!participant) throw new KittyError("Participant not found", 404);
  if (participant.token !== token) throw new KittyError("This name belongs to someone else in this session", 403);
  const index = participant.restrictions.indexOf(restriction);
  if (index === -1) throw new KittyError("Restriction not found", 404);
  participant.restrictions.splice(index, 1);
  return session;
}

export function finalizeSession(sessionId: string, hostToken: string): OrderSession {
  const session = getSession(sessionId);
  if (session.hostToken !== hostToken) throw new KittyError("Only the host can finalize this order", 403);
  session.finalized = true;
  return session;
}

export function computeSplit(sessionId: string) {
  const session = getSession(sessionId);
  const perParticipant = Object.values(session.participants).map((p) => {
    const total = p.lines.reduce((sum, l) => {
      const item = MENU.find((m) => m.id === l.itemId);
      return sum + (item ? item.price * l.qty : 0);
    }, 0);
    return { name: p.name, total: Math.round(total * 100) / 100, restrictions: p.restrictions };
  });
  const grandTotal = Math.round(perParticipant.reduce((sum, p) => sum + p.total, 0) * 100) / 100;
  const equalShare = perParticipant.length > 0 ? Math.round((grandTotal / perParticipant.length) * 100) / 100 : 0;
  return { perParticipant, grandTotal, equalShare };
}

export function serializeSession(session: OrderSession) {
  return {
    id: session.id,
    finalized: session.finalized,
    menu: MENU,
    participants: Object.values(session.participants).map((p) => ({
      name: p.name,
      lines: p.lines,
      restrictions: p.restrictions,
    })),
  };
}
