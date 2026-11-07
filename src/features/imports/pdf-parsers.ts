// Escolhe o leitor pelo banco do extrato e devolve sempre o mesmo formato.
import { isInterStatement, parseInterStatement } from "./pdf-inter";
import { isC6Statement, parseC6Statement } from "./pdf-c6";
import { brDate, formatCents, type BankStatement } from "./statement-common";

export const SUPPORTED_BANKS = "Banco Inter e C6 Bank";

function fromInter(pages: string[]): BankStatement {
  const st = parseInterStatement(pages);
  const problems: string[] = [];
  for (const m of st.balanceMismatches) {
    problems.push(`Saldo da linha ${m.index + 1} (${brDate(m.date)}) não fecha: esperado ${formatCents(m.expectedCents)}, extrato ${formatCents(m.gotCents)}`);
  }
  for (const m of st.dayMismatches) {
    problems.push(`Saldo do dia ${brDate(m.date)} não fecha: extrato ${formatCents(m.expectedCents)}, lido ${formatCents(m.gotCents)}`);
  }
  problems.push(...st.warnings);
  const first = st.rows[0];
  const signed = first ? (first.kind === "expense" ? -1 : 1) * Math.round(Number(first.amount) * 100) : 0;
  return {
    bank: "inter",
    holder: st.holder,
    periodStart: st.periodStart,
    periodEnd: st.periodEnd,
    openingBalanceCents: first ? first.balanceCents - signed : null,
    openingDate: first ? first.date : null,
    rows: st.rows.map((r) => ({ date: r.date, description: r.description, amount: r.amount, kind: r.kind, opType: r.opType, selfTransfer: r.selfTransfer })),
    problems,
    headerBalanceMatches: st.headerBalanceMatches,
  };
}

export function parseBankStatement(pages: string[]): BankStatement {
  const text = pages.join("\n");
  if (isInterStatement(text)) return fromInter(pages);
  if (isC6Statement(text)) return parseC6Statement(pages);
  throw new Error(`Formato de extrato não reconhecido. Por enquanto o sistema lê PDF com texto do ${SUPPORTED_BANKS}.`);
}

export function statementIntegrityOk(st: BankStatement): boolean {
  return st.problems.length === 0 && st.headerBalanceMatches !== false;
}
