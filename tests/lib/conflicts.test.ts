import { describe, expect, it } from "vitest";
import { findConflicts } from "@/lib/kitty/conflicts";
import { MENU } from "@/lib/kitty/menu";

describe("findConflicts", () => {
  it("flags a non-vegan item for a participant with a vegan restriction", () => {
    const conflicts = findConflicts(["vegan"], [{ itemId: "burrito" }], MENU);
    expect(conflicts).toEqual(["Burrito may not be vegan"]);
  });

  it("flags a gluten-containing item for a gluten-free restriction", () => {
    const conflicts = findConflicts(["gluten-free"], [{ itemId: "burrito" }], MENU);
    expect(conflicts).toEqual(["Burrito contains gluten"]);
  });

  it("does not flag anything when there's no conflict", () => {
    const conflicts = findConflicts(["vegan"], [{ itemId: "chips-guac" }], MENU);
    expect(conflicts).toEqual([]);
  });
});
