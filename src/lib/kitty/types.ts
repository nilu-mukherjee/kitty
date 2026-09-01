export type MenuItem = {
  id: string;
  name: string;
  price: number;
  tags: string[];
};

export type OrderLine = {
  lineId: string;
  itemId: string;
  qty: number;
  notes?: string;
};

export type Participant = {
  name: string;
  token: string;
  lines: OrderLine[];
  restrictions: string[];
};

export type OrderSession = {
  id: string;
  hostToken: string;
  finalized: boolean;
  createdAt: number;
  participants: Record<string, Participant>;
};
