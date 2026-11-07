// Importação sem bloqueio: linhas sem categoria entram como "Sem categoria" e divergências de valor entram sem vínculo.
// O usuário reclassifica e concilia depois.
export const UNCATEGORIZED_NAME = "Sem categoria";

type Kind = "income" | "expense";

export function kindsNeedingFallback(rows: { kind: string; categoryId: string }[]): Kind[] {
  const kinds = new Set<Kind>();
  for (const r of rows) {
    if (!r.categoryId && (r.kind === "income" || r.kind === "expense")) kinds.add(r.kind);
  }
  return [...kinds];
}

export function applyFallbackCategories<T extends { kind: string; categoryId: string }>(rows: T[], ids: Partial<Record<Kind, string>>): T[] {
  return rows.map((r) => {
    if (r.categoryId || (r.kind !== "income" && r.kind !== "expense")) return r;
    const id = ids[r.kind];
    if (!id) throw new Error(`Categoria "${UNCATEGORIZED_NAME}" indisponível`);
    return { ...r, categoryId: id };
  });
}

export function countUncategorized(rows: { kind: string; categoryId: string }[]): number {
  return rows.filter((r) => !r.categoryId && r.kind !== "transfer").length;
}

export function countDivergent(rows: { action: string }[]): number {
  return rows.filter((r) => r.action === "unresolved").length;
}

// Divergência de valor ainda não decidida: importa sem vínculo com o previsto (equivale a "Rejeitar").
export function settleDivergences<T extends { action: string; recurringId: string; occurrenceDate: string }>(rows: T[]): T[] {
  return rows.map((r) => (r.action === "unresolved" ? { ...r, recurringId: "", occurrenceDate: "", action: "reject" } : r));
}
