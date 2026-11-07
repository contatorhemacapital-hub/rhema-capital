// Converte lançamentos lidos de um extrato PDF em linhas de importação (mesmo formato do CSV):
// valida, sugere categoria, marca duplicados por contagem e entrega para a prévia/conciliação.
import { fingerprint, normalize, type ImportRow, type Rule } from "./logic";
import { validDate } from "@/features/planning/logic";
import { toCents } from "@/features/finance/money";

export type StatementRow = {
  date: string;
  description: string;
  amount: string;
  kind: "income" | "expense";
  opType: string;
  selfTransfer: boolean;
};

export type PdfStatementResult = {
  bank: "inter" | "c6";
  rows: StatementRow[];
  periodStart: string | null;
  periodEnd: string | null;
  openingBalanceCents: number | null;
  openingDate: string | null;
  integrityOk: boolean;
  problems: string[];
  headerBalanceMatches: boolean | null;
};

type Cat = { id: string; name?: string; kind: string; archived_at: string | null };
type Existing = { date: string; amount: number | string; description: string; kind: string; external_ref: string | null };

// Movimentações internas: não são renda nem despesa de verdade (aplicar, resgatar, pagar fatura, mover entre contas próprias).
export const NEUTRAL_CATEGORY = {
  invest_apply: "Aplicação em investimentos",
  invest_redeem: "Resgate de investimentos",
  card_bill: "Pagamento de fatura de cartão",
  self_transfer: "Transferência entre contas próprias",
} as const;

// Sugestões conservadoras: só comerciantes e empresas inequívocos. O restante fica para as regras do usuário.
export const KEYWORD_SUGGESTIONS: { terms: string[]; category: string }[] = [
  { terms: ["uber do brasil", "99 tecnologia"], category: "Aplicativos de transporte" },
  { terms: ["brb mobilida"], category: "Transporte público" },
  { terms: ["neoenergia"], category: "Luz" },
  { terms: ["claro"], category: "Telefone Celular" },
  { terms: ["tecplay"], category: "Internet de casa" },
  { terms: ["drogaria", "farmacia", "drogasil", "droga big"], category: "Farmácia" },
  { terms: ["servopa", "consorcio"], category: "Prestação Consórcio" },
  { terms: ["auto posto"], category: "Combustível" },
  { terms: ["ifood", "restaurante", "pizzaria", "churrascaria", "pastelaria", "burger", "acai", "dunkin", "doceria", "salgados"], category: "Restaurantes" },
  {
    terms: ["atacadao", "atacadista", "acougue", "mercearia", "hortifruti", "mini mart", "sacolao", "carnes", "panificadora", "padaria", "supermercado"],
    category: "Alimentação (supermercado, feira, padaria)",
  },
];

function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasTerm(text: string, term: string): boolean {
  return ` ${text} `.includes(` ${plain(term)} `) || (term.length > 4 && text.includes(plain(term)));
}

function findCategory(categories: Cat[], name: string, kind: string): string {
  return categories.find((c) => c.name === name && c.kind === kind && !c.archived_at)?.id ?? "";
}

function neutralName(row: StatementRow): string | null {
  if (row.selfTransfer) return NEUTRAL_CATEGORY.self_transfer;
  if (row.opType === "investment_apply") return NEUTRAL_CATEGORY.invest_apply;
  if (row.opType === "investment_redeem") return NEUTRAL_CATEGORY.invest_redeem;
  if (row.opType === "card_bill_payment") return NEUTRAL_CATEGORY.card_bill;
  return null;
}

export function suggestCategoryId(row: StatementRow, rules: Rule[], categories: Cat[]): string {
  const text = plain(row.description);
  const byRule = [...rules]
    .sort((a, b) => b.term.length - a.term.length)
    .find((r) => normalize(row.description).includes(normalize(r.term)) && categories.some((c) => c.id === r.category_id && c.kind === row.kind && !c.archived_at));
  if (byRule) return byRule.category_id;
  const neutral = neutralName(row);
  if (neutral) {
    const id = findCategory(categories, neutral, row.kind);
    if (id) return id;
  }
  if (row.kind === "expense") {
    for (const s of KEYWORD_SUGGESTIONS) {
      if (s.terms.some((t) => hasTerm(text, t))) {
        const id = findCategory(categories, s.category, "expense");
        if (id) return id;
      }
    }
  }
  return "";
}

export function rowsFromStatement(rows: StatementRow[], rules: Rule[], categories: Cat[], existing: Existing[]): ImportRow[] {
  const existingCounts = new Map<string, number>();
  for (const item of existing) {
    const fp = fingerprint(item);
    existingCounts.set(fp, (existingCounts.get(fp) ?? 0) + 1);
  }
  const usedCounts = new Map<string, number>();
  return rows.map((r) => {
    let error = "";
    if (!validDate.safeParse(r.date).success) error = "Data inválida";
    if (!/^\d{1,14}(\.\d{1,2})?$/.test(r.amount) || toCents(r.amount) <= 0) error = "Valor inválido ou zero";
    if (!r.description || r.description.length > 200) error = "Descrição inválida";
    const fp = fingerprint({ date: r.date, description: r.description, amount: r.amount, kind: r.kind });
    const used = usedCounts.get(fp) ?? 0;
    const duplicate = used < (existingCounts.get(fp) ?? 0);
    if (duplicate) usedCounts.set(fp, used + 1);
    return {
      date: r.date,
      description: r.description,
      amount: r.amount,
      kind: r.kind,
      categoryId: suggestCategoryId(r, rules, categories),
      destinationAccountId: "",
      externalRef: "",
      error,
      duplicate,
      include: !duplicate && !error,
      recurringId: "",
      occurrenceDate: "",
      action: "reject",
    };
  });
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      resolve(btoa(binary));
    };
    reader.readAsArrayBuffer(file);
  });
}
