import { describe, it, expect } from "vitest";
import { UNCATEGORIZED_NAME, applyFallbackCategories, countDivergent, countUncategorized, kindsNeedingFallback, settleDivergences } from "@/features/imports/uncategorized";

const row = (p: Partial<{ kind: string; categoryId: string; action: string; recurringId: string; occurrenceDate: string }> = {}) => ({
  kind: "expense", categoryId: "", action: "reject", recurringId: "", occurrenceDate: "", ...p,
});

describe("importação sem bloqueio", () => {
  it("o nome da categoria de apoio é 'Sem categoria'", () => {
    expect(UNCATEGORIZED_NAME).toBe("Sem categoria");
  });

  it("identifica os tipos que precisam de categoria de apoio, sem repetir e ignorando transferências", () => {
    const rows = [row(), row(), row({ kind: "income" }), row({ kind: "transfer" }), row({ categoryId: "c1" })];
    expect(kindsNeedingFallback(rows).sort()).toEqual(["expense", "income"]);
    expect(kindsNeedingFallback([row({ categoryId: "c1" })])).toEqual([]);
    expect(kindsNeedingFallback([row({ kind: "transfer" })])).toEqual([]);
  });

  it("preenche só as linhas sem categoria, com a categoria do mesmo tipo", () => {
    const out = applyFallbackCategories([row(), row({ kind: "income" }), row({ categoryId: "minha" }), row({ kind: "transfer" })], { expense: "sc-d", income: "sc-r" });
    expect(out.map((r) => r.categoryId)).toEqual(["sc-d", "sc-r", "minha", ""]);
  });

  it("falha com clareza se a categoria de apoio não existir", () => {
    expect(() => applyFallbackCategories([row()], {})).toThrow(/Sem categoria/);
  });

  it("não altera as linhas originais", () => {
    const original = [row()];
    applyFallbackCategories(original, { expense: "x" });
    expect(original[0]!.categoryId).toBe("");
  });

  it("conta linhas sem categoria e divergências para avisar o usuário", () => {
    expect(countUncategorized([row(), row({ categoryId: "c" }), row({ kind: "transfer" })])).toBe(1);
    expect(countDivergent([row({ action: "unresolved" }), row({ action: "auto" }), row({ action: "unresolved" })])).toBe(2);
  });

  it("divergência não decidida vira importação sem vínculo; as decididas ficam como estão", () => {
    const out = settleDivergences([
      row({ action: "unresolved", recurringId: "r1", occurrenceDate: "2026-03-10" }),
      row({ action: "auto", recurringId: "r2", occurrenceDate: "2026-03-10" }),
      row({ action: "adjust", recurringId: "r3", occurrenceDate: "2026-03-10" }),
      row({ action: "month", recurringId: "r4", occurrenceDate: "2026-03-10" }),
    ]);
    expect(out.map((r) => [r.action, r.recurringId, r.occurrenceDate])).toEqual([
      ["reject", "", ""],
      ["auto", "r2", "2026-03-10"],
      ["adjust", "r3", "2026-03-10"],
      ["month", "r4", "2026-03-10"],
    ]);
  });
});
