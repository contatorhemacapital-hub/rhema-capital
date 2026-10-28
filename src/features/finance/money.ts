// Monetary helpers. Amounts travel as decimal strings ("1234.56") and are summed
// as integer cents to avoid floating point drift.

export function toCents(value: number | string): number {
  const s = typeof value === "number" ? value.toFixed(2) : value;
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s.trim());
  if (!m) throw new Error(`Valor inválido: ${s}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -cents : cents;
}

export function fromCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Parses user input in pt-BR ("1.234,56") or plain ("1234.56") form. Returns "1234.56" or null. */
export function parseMoneyInput(input: string): string | null {
  let s = input.replace(/\s|R\$/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return fromCents(toCents(s));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatMoney(value: number | string, currency = "BRL"): string {
  const n = toCents(value) / 100;
  if (currency === "BRL") return brl.format(n);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export type TxLike = {
  kind: "income" | "expense" | "transfer";
  status: "pending" | "posted" | "cancelled";
  account_id: string;
  destination_account_id: string | null;
  amount: number | string;
};

/** Effect of one transaction on one account, in cents (posted only). */
export function effectOn(tx: TxLike, accountId: string): number {
  if (tx.status !== "posted") return 0;
  const c = toCents(tx.amount);
  if (tx.kind === "income" && tx.account_id === accountId) return c;
  if (tx.kind === "expense" && tx.account_id === accountId) return -c;
  if (tx.kind === "transfer") {
    if (tx.destination_account_id === accountId) return c;
    if (tx.account_id === accountId) return -c;
  }
  return 0;
}

export function accountBalanceCents(openingBalance: number | string, txs: TxLike[], accountId: string) {
  return txs.reduce((sum, t) => sum + effectOn(t, accountId), toCents(openingBalance));
}

/** Cash-basis totals: posted income/expense only. Transfers never count. */
export function summarize(txs: TxLike[]) {
  let income = 0;
  let expense = 0;
  let pending = 0;
  for (const t of txs) {
    if (t.kind === "transfer") continue;
    if (t.status === "posted") {
      if (t.kind === "income") income += toCents(t.amount);
      else expense += toCents(t.amount);
    } else if (t.status === "pending") pending += 1;
  }
  return { income, expense, net: income - expense, pending };
}
