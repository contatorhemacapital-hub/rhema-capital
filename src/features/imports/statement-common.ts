// Tipos e utilitários comuns aos leitores de extrato em PDF (um leitor por banco).
export type BankId = "inter" | "c6";

export type ParsedRow = {
  date: string; // AAAA-MM-DD
  description: string;
  amount: string; // valor absoluto com 2 casas
  kind: "income" | "expense";
  opType: string;
  selfTransfer: boolean;
};

export type BankStatement = {
  bank: BankId;
  holder: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalanceCents: number | null; // saldo antes do primeiro lançamento
  openingDate: string | null; // data do primeiro lançamento
  rows: ParsedRow[];
  problems: string[]; // falhas de conferência, em português
  headerBalanceMatches: boolean | null;
};

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

export function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
