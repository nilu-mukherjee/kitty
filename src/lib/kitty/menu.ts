import type { MenuItem } from "./types";

export const MENU: MenuItem[] = [
  { id: "burrito", name: "Burrito", price: 9.5, tags: ["contains-gluten"] },
  { id: "taco-plate", name: "Taco Plate (3)", price: 8, tags: ["gluten-free"] },
  { id: "quesadilla", name: "Quesadilla", price: 7.5, tags: ["contains-dairy", "contains-gluten"] },
  { id: "salad-bowl", name: "Salad Bowl", price: 8.5, tags: ["gluten-free", "vegan"] },
  { id: "chips-guac", name: "Chips & Guac", price: 4, tags: ["vegan", "gluten-free"] },
  { id: "horchata", name: "Horchata", price: 3, tags: ["contains-dairy"] },
];
