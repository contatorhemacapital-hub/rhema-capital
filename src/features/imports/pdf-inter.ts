// Leitor de extratos em PDF do Banco Inter (texto já extraído do PDF).
// Função pura: recebe o texto das páginas e devolve lançamentos + verificações de saldo.
// Cada lançamento traz o saldo da linha; a cadeia de saldos prova que nenhuma linha foi perdida ou lida errada.

export type InterOpType =
  | "pix_sent" | "pix_received" | "pix_refund"
  | "debit_purchase" | "transit" | "investment_redeem" | "investment_apply"
  | "card_bill_payment" | "bill_payment" | "fee" | "credit_release" | "refund" | "other";

export type InterRow = {
  date: string; // AAAA-MM-DD
  description: string;
  amount: string; // valor absoluto com 2 casas, ex.: "45.90"
  kind: "income" | "expense";
  balanceCents: number; // saldo após o lançamento
  opType: InterOpType;
  counterparty: string;
  selfTransfer: boolean; // contraparte é o próprio titular
  raw: string;
};

export type InterCheck = { index: number; date: string; expectedCents: number; gotCents: number };

export type InterStatement = {
  bank: "inter";
  holder: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  rows: InterRow[];
  balanceMismatches: InterCheck[]; // linhas em que saldo anterior + valor != saldo da linha
  dayMismatches: { date: string; expectedCents: number; gotCents: number }[]; // último saldo do dia != "Saldo do dia"
  orphanRecords: number; // linhas que parecem lançamentos mas vieram antes de qualquer data (possível perda)
  headerBalanceCents: number | null; // "Saldo total" do cabeçalho
  headerBalanceMatches: boolean | null; // último saldo lido == "Saldo total" (informativo)
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const MONEY = "-?R\\$\\s?[\\d.]+,\\d{2}";
const DAY_RE = new RegExp(`^(\\d{1,2}) de ([A-Za-zÀ-ÿ]+) de (\\d{4}) Saldo do dia: (${MONEY})`);
const RECORD_RE = new RegExp(`^(.*?)\\s*(${MONEY})\\s+(${MONEY})$`);
const COLUMN_TITLE_RE = /^Valor Saldo por transa[cç][aã]o\s*/i;
const FOOTER_RE = /^(?:Fale com a gente\s*)?SAC:.*?979 7099/i;
const MAX_LINES_PER_RECORD = 4;
const MAX_DESCRIPTION = 200;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeName(s: string): string {
  return stripAccents(s).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function moneyToCents(token: string): number {
  const neg = token.trim().startsWith("-");
  const digits = token.replace(/[^\d,]/g, "").replace(",", "");
  const cents = Number.parseInt(digits, 10);
  return neg ? -cents : cents;
}

export function centsToAmount(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function isoDate(day: string, monthName: string, year: string): string | null {
  const m = MONTHS[stripAccents(monthName).toLowerCase()];
  if (!m) return null;
  const d = Number(day);
  const y = Number(year);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function brDateToIso(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function classify(type: string, detail: string): InterOpType {
  const t = stripAccents(type).toLowerCase();
  const d = stripAccents(detail).toLowerCase();
  if (t.startsWith("pix enviado devolvido") || t.startsWith("pix recebido devolvido")) return "pix_refund";
  if (t.startsWith("pix enviado")) return "pix_sent";
  if (t.startsWith("pix recebido")) return "pix_received";
  if (t.startsWith("compra meio de transporte")) return "transit";
  if (t.startsWith("compra no debito")) return "debit_purchase";
  if (t.startsWith("resgate")) return "investment_redeem";
  if (t.startsWith("aplicacao")) return "investment_apply";
  if (t.startsWith("pagamento efetuado") && (d.includes("fatura") || t.includes("fatura"))) return "card_bill_payment";
  if (t.startsWith("pagamento de titulo") || t.startsWith("pagamento efetuado")) return "bill_payment";
  if (t.startsWith("deb cartao") || t.includes("tarifa")) return "fee";
  if (t.startsWith("credito liberado")) return "credit_release";
  if (t.startsWith("estorno")) return "refund";
  return "other";
}

function cleanCounterparty(opType: InterOpType, detail: string): string {
  let s = detail.replace(/^"+|"+$/g, "").trim();
  if (opType === "debit_purchase" || opType === "transit") {
    return s.replace(/^No estabelecimento\s+/i, "").trim();
  }
  if (opType === "pix_sent" || opType === "pix_received" || opType === "pix_refund") {
    s = s.replace(/^Cp\s*:\s*\d+-/i, "").replace(/^Cp\s*:\s*[\d-]+-/i, "");
    s = s.replace(/^[\d.\-/ ]+(?=[A-Za-zÀ-ÿ])/, "").trim();
    return s;
  }
  return s;
}

function parseRecord(text: string, amountTok: string, balanceTok: string, date: string, raw: string, holderNorm: string | null): InterRow {
  const colon = text.indexOf(": ");
  const type = (colon >= 0 ? text.slice(0, colon) : text).trim();
  const detail = colon >= 0 ? text.slice(colon + 2).trim() : "";
  const opType = classify(type, detail);
  const counterparty = cleanCounterparty(opType, detail);
  const cents = moneyToCents(amountTok);
  const description = (counterparty ? `${type}: ${counterparty}` : type).replace(/\s+/g, " ").slice(0, MAX_DESCRIPTION);
  const selfTransfer = Boolean(holderNorm) && (opType === "pix_sent" || opType === "pix_received" || opType === "pix_refund") && normalizeName(counterparty) === holderNorm;
  return {
    date, description, amount: centsToAmount(cents), kind: cents < 0 ? "expense" : "income",
    balanceCents: moneyToCents(balanceTok), opType, counterparty, selfTransfer, raw,
  };
}

export function isInterStatement(text: string): boolean {
  return /Institui[cç][aã]o:\s*Banco Inter/i.test(text) && /Saldo do dia:/i.test(text);
}

export function parseInterStatement(input: string | string[]): InterStatement {
  const text = Array.isArray(input) ? input.join("\n") : input;
  if (!isInterStatement(text)) throw new Error("Formato de extrato não reconhecido (esperado: Banco Inter)");
  // O texto extraído do PDF pode colar o título da coluna e o rodapé do banco à linha seguinte.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .map((l) => l.replace(COLUMN_TITLE_RE, "").replace(FOOTER_RE, "").trim())
    .filter((l) => l && !/^Fale com a gente$/i.test(l));

  const warnings: string[] = [];
  const period = text.match(/Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
  const holderIdx = lines.findIndex((l) => /^Solicitado em:/i.test(l));
  const holder = holderIdx >= 0 && lines[holderIdx + 1] && !/^CPF/i.test(lines[holderIdx + 1]!) ? lines[holderIdx + 1]! : null;
  const holderNorm = holder ? normalizeName(holder) : null;

  const headerIdx = lines.findIndex((l) => /^Saldo total$/i.test(l));
  const headerTok = headerIdx >= 0 ? lines[headerIdx + 1]?.match(new RegExp(`^${MONEY}$`)) : null;
  const headerBalanceCents = headerTok ? moneyToCents(headerTok[0]) : null;

  const rows: InterRow[] = [];
  const balanceMismatches: InterCheck[] = [];
  const dayMismatches: InterStatement["dayMismatches"] = [];

  let currentDate: string | null = null;
  let dayClosing: number | null = null;
  let lastBalance: number | null = null;
  let buf: string[] = [];
  let orphanRecords = 0;

  const closeDay = () => {
    if (currentDate !== null && dayClosing !== null && lastBalance !== null && rows.some((r) => r.date === currentDate)) {
      if (lastBalance !== dayClosing) dayMismatches.push({ date: currentDate, expectedCents: dayClosing, gotCents: lastBalance });
    }
  };

  for (const line of lines) {
    const day = line.match(DAY_RE);
    if (day) {
      if (buf.length) { warnings.push(`Registro incompleto antes de ${line.slice(0, 30)}: ${buf.join(" ").slice(0, 80)}`); buf = []; }
      closeDay();
      const iso = isoDate(day[1]!, day[2]!, day[3]!);
      if (!iso) { warnings.push(`Data inválida: ${line.slice(0, 40)}`); currentDate = null; dayClosing = null; continue; }
      currentDate = iso;
      dayClosing = moneyToCents(day[4]!);
      continue;
    }
    if (currentDate === null) {
      if (RECORD_RE.test(line)) orphanRecords++;
      continue;
    }
    buf.push(line);
    const joined = buf.join(" ");
    const m = joined.match(RECORD_RE);
    if (m) {
      const row = parseRecord(m[1]!.trim(), m[2]!, m[3]!, currentDate, joined, holderNorm);
      const signed = row.kind === "expense" ? -Math.round(Number(row.amount) * 100) : Math.round(Number(row.amount) * 100);
      if (lastBalance !== null && lastBalance + signed !== row.balanceCents) {
        balanceMismatches.push({ index: rows.length, date: row.date, expectedCents: lastBalance + signed, gotCents: row.balanceCents });
      }
      lastBalance = row.balanceCents;
      rows.push(row);
      buf = [];
    } else if (buf.length >= MAX_LINES_PER_RECORD) {
      warnings.push(`Linha não reconhecida: ${joined.slice(0, 80)}`);
      buf = [];
    }
  }
  if (buf.length) warnings.push(`Registro incompleto no fim do arquivo: ${buf.join(" ").slice(0, 80)}`);
  closeDay();
  if (orphanRecords > 0) warnings.push(`${orphanRecords} linha(s) com cara de lançamento antes da primeira data foram ignoradas`);
  const lastRow = rows[rows.length - 1];
  const headerBalanceMatches = headerBalanceCents !== null && lastRow ? lastRow.balanceCents === headerBalanceCents : null;

  return {
    bank: "inter", holder,
    periodStart: period ? brDateToIso(period[1]!) : null,
    periodEnd: period ? brDateToIso(period[2]!) : null,
    rows, balanceMismatches, dayMismatches, orphanRecords, headerBalanceCents, headerBalanceMatches, warnings,
  };
}
