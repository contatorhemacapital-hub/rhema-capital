// Leitor de extratos em PDF do C6 Bank (texto já extraído do PDF).
// O C6 não informa saldo por linha: informa o "Saldo contábil" ao fim de cada dia de PROCESSAMENTO
// e, no cabeçalho de cada mês, o total de entradas e saídas. As duas conferências usam isso.
import { centsToAmount, moneyToCents, normalizeName, stripAccents } from "./pdf-inter";
import { brDate, formatCents, type BankStatement, type ParsedRow } from "./statement-common";

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const MONEY = "-?R\\$\\s?[\\d.]+,\\d{2}";
const MONTH_RE = new RegExp(`^([A-Za-zÀ-ÿ]+) (\\d{4}) \\( (\\d{2}/\\d{2}/\\d{4}) - (\\d{2}/\\d{2}/\\d{4}) \\) Entradas: (${MONEY}) • Sa[ií]das: (${MONEY})$`, "i");
const BALANCE_RE = new RegExp(`^Saldo cont[aá]bil do dia (\\d{2})/(\\d{2})/(\\d{2}) (${MONEY})$`, "i");
const RECORD_START = /^(\d{2})\/(\d{2}) (\d{2})\/(\d{2}) (.+)$/;
const RECORD_END = new RegExp(`^(.*?)\\s*(${MONEY})$`);
const FOOTER_RE = /\d+\/\d+ C6 Bank • Av\. Nove de Julho.*?S[aã]o Paulo\/SP/gi;
const NOISE: RegExp[] = [
  /^Data$/i,
  /^da transa[cç][aã]o$/i,
  /^de processamento Tipo Descri[cç][aã]o Valor$/i,
  /^Data de processamento/i,
  /^Sem lan[cç]amentos no m[eê]s$/i,
  /^Informa[cç][oõ]es sujeitas/i,
];
const MAX_LINES_PER_RECORD = 4;
const MAX_DESCRIPTION = 200;

// Tipos de lançamento conhecidos (mais longos primeiro). Tipo desconhecido não impede a leitura.
const KNOWN_TYPES = [
  "Saída PIX", "Entrada PIX", "Devolução PIX", "Débito de Cartão", "Crédito de Cartão", "Outros gastos", "Entradas", "Saídas",
  "Pagamento", "Saída TED", "Entrada TED", "Transferência", "Tarifa", "Saque", "Depósito", "Aplicação", "Resgate", "Rendimento", "Estorno",
].sort((a, b) => b.length - a.length);

function plainLower(s: string): string {
  return stripAccents(s).toLowerCase();
}

export function isC6Statement(text: string): boolean {
  return /Extrato da conta/i.test(text) && /Saldo cont[aá]bil do dia/i.test(text) && (/C6\s*Bank/i.test(text) || /Saldo no dia da exporta[cç][aã]o/i.test(text));
}

function splitType(middle: string): { type: string; desc: string } {
  const n = plainLower(middle);
  for (const t of KNOWN_TYPES) {
    const tn = plainLower(t);
    if (n === tn || n.startsWith(`${tn} `)) return { type: middle.slice(0, t.length), desc: middle.slice(t.length).trim() };
  }
  return { type: "", desc: middle.trim() };
}

function cleanName(raw: string): string {
  return raw.replace(/^[\d.\-/ ]+(?=[A-Za-zÀ-ÿ])/, "").replace(/\s+/g, " ").trim();
}

function describe(type: string, desc: string, holderNorm: string | null) {
  const t = plainLower(type);
  let opType = "other";
  let counterparty = "";
  let description = desc || type;
  if (t === "saida pix") {
    opType = "pix_sent";
    counterparty = cleanName(desc.replace(/^Pix enviado para\s+/i, ""));
    description = `Pix enviado: ${counterparty}`;
  } else if (t === "entrada pix") {
    opType = "pix_received";
    counterparty = cleanName(desc.replace(/^Pix recebido de\s+/i, ""));
    description = `Pix recebido: ${counterparty}`;
  } else if (t === "devolucao pix") {
    opType = "pix_refund";
    counterparty = cleanName(desc.replace(/^Devol(?:u[cç][aã]o)?\.?\s+(?:recebida|enviada)?\s*pix de\s+/i, ""));
    description = `Devolução Pix: ${counterparty}`;
  } else if (t === "debito de cartao") {
    opType = "debit_purchase";
    description = `Débito de cartão: ${desc}`;
  } else if (t === "outros gastos" && /tarifa/i.test(desc)) {
    opType = "fee";
  } else if (t === "pagamento") {
    opType = "bill_payment";
    description = `Pagamento: ${desc}`;
  } else if (t === "entradas" && /\bTED\b/i.test(desc)) {
    opType = "ted_received";
  } else if (t === "entradas" && /dep[oó]sito/i.test(desc)) {
    opType = "deposit";
  } else if (t.startsWith("aplicacao")) {
    opType = "investment_apply";
  } else if (t.startsWith("resgate")) {
    opType = "investment_redeem";
  }
  const selfTransfer = Boolean(holderNorm) && (opType === "pix_sent" || opType === "pix_received" || opType === "pix_refund") && normalizeName(counterparty) === holderNorm;
  return { opType, selfTransfer, description: description.replace(/\s+/g, " ").slice(0, MAX_DESCRIPTION) };
}

function validIso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Block = { label: string; year: number; incomeCents: number; expenseCents: number; readIncome: number; readExpense: number };

export function parseC6Statement(input: string | string[]): BankStatement {
  const text = Array.isArray(input) ? input.join("\n") : input;
  if (!isC6Statement(text)) throw new Error("Formato de extrato não reconhecido (esperado: C6 Bank)");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").replace(FOOTER_RE, " ").replace(/\s+/g, " ").trim())
    .filter((l) => l && !NOISE.some((re) => re.test(l)));

  const problems: string[] = [];
  const holderLine = lines.find((l) => /CNPJ:|CPF:/i.test(l) && l.includes("•")) ?? null;
  const holder = holderLine ? holderLine.split("•")[0]!.trim() : null;
  const holderNorm = holder ? normalizeName(holder).replace(/^(\d+ )+/, "") : null;
  const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/);
  const toIso = (br: string) => `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;
  const exportIdx = lines.findIndex((l) => /^Saldo no dia da exporta[cç][aã]o$/i.test(l));
  const exportTok = exportIdx >= 0 ? lines[exportIdx + 1]?.match(new RegExp(`^${MONEY}$`)) : null;
  const exportBalance = exportTok ? moneyToCents(exportTok[0]) : null;

  type Row = ParsedRow & { procIso: string; signed: number };
  const rows: Row[] = [];
  const blocks: Block[] = [];
  const balances: { iso: string; cents: number }[] = [];
  let block: Block | null = null;
  let buf: string[] = [];
  let orphan = 0;

  const flush = (why: string) => {
    if (buf.length) problems.push(`Registro incompleto ${why}: ${buf.join(" ").slice(0, 80)}`);
    buf = [];
  };

  for (const line of lines) {
    const mh = line.match(MONTH_RE);
    if (mh && MONTHS[stripAccents(mh[1]!).toLowerCase()]) {
      flush("antes de um novo mês");
      block = { label: `${mh[1]} ${mh[2]}`, year: Number(mh[2]), incomeCents: moneyToCents(mh[5]!), expenseCents: Math.abs(moneyToCents(mh[6]!)), readIncome: 0, readExpense: 0 };
      blocks.push(block);
      continue;
    }
    const bl = line.match(BALANCE_RE);
    if (bl) {
      flush("antes de um saldo");
      const iso = validIso(2000 + Number(bl[3]), Number(bl[2]), Number(bl[1]));
      if (iso) balances.push({ iso, cents: moneyToCents(bl[4]!) });
      else problems.push(`Data de saldo inválida: ${line.slice(0, 40)}`);
      continue;
    }
    if (RECORD_START.test(line)) {
      flush("antes de outra linha");
      buf = [line];
    } else if (buf.length) {
      buf.push(line);
    } else {
      continue;
    }
    const joined = buf.join(" ");
    const end = joined.match(RECORD_END);
    if (!end) {
      if (buf.length >= MAX_LINES_PER_RECORD) flush("(linha não reconhecida)");
      continue;
    }
    const start = joined.match(RECORD_START)!;
    buf = [];
    if (!block) { orphan++; continue; }
    const tm = Number(start[2]);
    const pm = Number(start[4]);
    const date = validIso(block.year, tm, Number(start[1]));
    const procIso = validIso(pm < tm ? block.year + 1 : block.year, pm, Number(start[3]));
    if (!date || !procIso) { problems.push(`Data inválida na linha: ${joined.slice(0, 60)}`); continue; }
    const middle = end[1]!.replace(/^\d{2}\/\d{2} \d{2}\/\d{2} /, "").trim();
    const { type, desc } = splitType(middle);
    const cents = moneyToCents(end[2]!);
    const info = describe(type, desc, holderNorm);
    if (cents < 0) block.readExpense += -cents; else block.readIncome += cents;
    rows.push({ date, procIso, signed: cents, description: info.description, amount: centsToAmount(cents), kind: cents < 0 ? "expense" : "income", opType: info.opType, selfTransfer: info.selfTransfer });
  }
  flush("no fim do arquivo");
  if (orphan > 0) problems.push(`${orphan} linha(s) com cara de lançamento antes do primeiro mês foram ignoradas`);

  for (const b of blocks) {
    if (b.readIncome !== b.incomeCents) problems.push(`Total de entradas de ${b.label} não fecha: extrato ${formatCents(b.incomeCents)}, lido ${formatCents(b.readIncome)}`);
    if (b.readExpense !== b.expenseCents) problems.push(`Total de saídas de ${b.label} não fecha: extrato ${formatCents(b.expenseCents)}, lido ${formatCents(b.readExpense)}`);
  }

  const cumulative = (iso: string) => rows.filter((r) => r.procIso <= iso).reduce((a, r) => a + r.signed, 0);
  let opening: number | null = null;
  if (balances.length) {
    opening = balances[0]!.cents - cumulative(balances[0]!.iso);
    for (const b of balances.slice(1)) {
      const expected = opening + cumulative(b.iso);
      if (expected !== b.cents) problems.push(`Saldo contábil de ${brDate(b.iso)} não fecha: extrato ${formatCents(b.cents)}, calculado ${formatCents(expected)}`);
    }
    const lastIso = balances[balances.length - 1]!.iso;
    const after = rows.filter((r) => r.procIso > lastIso).length;
    if (after > 0) problems.push(`${after} lançamento(s) depois do último saldo contábil não puderam ser conferidos`);
  } else if (rows.length) {
    problems.push("Nenhum saldo contábil encontrado: não foi possível conferir os lançamentos");
  }
  const lastBalance = balances.length ? balances[balances.length - 1]!.cents : null;
  const headerBalanceMatches = exportBalance !== null && lastBalance !== null ? exportBalance === lastBalance : null;
  const firstDate = rows.map((r) => r.date).sort()[0] ?? null;

  return {
    bank: "c6", holder,
    periodStart: periodMatch ? toIso(periodMatch[1]!) : null,
    periodEnd: periodMatch ? toIso(periodMatch[2]!) : null,
    openingBalanceCents: opening, openingDate: firstDate,
    rows: rows.map(({ procIso: _p, signed: _s, ...r }) => r),
    problems, headerBalanceMatches,
  };
}
