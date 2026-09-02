import type { MenuItem } from "./types";

export function findConflicts(
  restrictions: string[],
  lines: { itemId: string }[],
  menu: MenuItem[]
): string[] {
  const orderedItems = lines
    .map((line) => menu.find((item) => item.id === line.itemId))
    .filter((item): item is MenuItem => Boolean(item));

  const conflicts = new Set<string>();

  for (const restriction of restrictions) {
    const r = restriction.toLowerCase();
    for (const item of orderedItems) {
      if (r.includes("vegan") && !item.tags.includes("vegan")) {
        conflicts.add(`${item.name} may not be vegan`);
      } else if (r.includes("gluten") && item.tags.includes("contains-gluten")) {
        conflicts.add(`${item.name} contains gluten`);
      } else if ((r.includes("dairy") || r.includes("lactose")) && item.tags.includes("contains-dairy")) {
        conflicts.add(`${item.name} contains dairy`);
      }
    }
  }

  return Array.from(conflicts);
}
