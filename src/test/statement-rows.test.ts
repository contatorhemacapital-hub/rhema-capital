import { describe, it, expect } from "vitest";
import { rowsFromStatement, suggestCategoryId, fileToBase64, KEYWORD_SUGGESTIONS, NEUTRAL_CATEGORY, type StatementRow } from "@/features/imports/statement-rows";
import { DEFAULT_CATEGORIES } from "@/features/planning/defaults";

let n = 0;
const cat = (name: string, kind: "income" | "expense", archived = false) => ({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, name, kind, archived_at: archived ? "2026-01-01" : null });
const cats = {
  uber: cat("Aplicativos de transporte", "expense"),
  bus: cat("Transporte público", "expense"),
  food: cat("Alimentação (supermercado, feira, padaria)", "expense"),
  restaurantes: cat("Restaurantes", "expense"),
  apply: cat("Aplicação em investimentos", "expense"),
  redeemIn: cat("Resgate de investimentos", "income"),
  selfOut: cat("Transferência entre contas próprias", "expense"),
  selfIn: cat("Transferência entre contas próprias", "income"),
  card: cat("Pagamento de fatura de cartão", "expense"),
  phoneArchived: cat("Telefone Celular", "expense", true),
  custom: cat("Mercado do bairro", "expense"),
};
const list = Object.values(cats);
const row = (p: Partial<StatementRow>): StatementRow => ({ date: "2026-02-01", description: "Compra no debito: X", amount: "10.00", kind: "expense", opType: "debit_purchase", selfTransfer: false, ...p });

describe("sugestão de categoria para linhas do extrato", () => {
  it("regra do usuário vence a sugestão automática", () => {
    const rules = [{ id: "r1", term: "atacadao", category_id: cats.custom.id }];
    expect(suggestCategoryId(row({ description: "Compra no debito: COSTA ATACADAO" }), rules, list)).toBe(cats.custom.id);
  });
  it("comerciantes conhecidos recebem categoria padrão", () => {
    expect(suggestCategoryId(row({ description: "Pix enviado: UBER DO BRASIL TECNOLOGIA LTDA", opType: "pix_sent" }), [], list)).toBe(cats.uber.id);
    expect(suggestCategoryId(row({ description: "Compra Meio De Transporte: BRB MOBILIDA*BUS 5033 BRASILIA BRA", opType: "transit" }), [], list)).toBe(cats.bus.id);
    expect(suggestCategoryId(row({ description: "Compra no debito: COSTA ATACADAO" }), [], list)).toBe(cats.food.id);
    expect(suggestCategoryId(row({ description: "Pix enviado: IFOODCOM AGENCIA DE RESTAURANTES ONLINE SA", opType: "pix_sent" }), [], list)).toBe(cats.restaurantes.id);
  });
  it("só sugere para despesas e respeita palavra inteira", () => {
    expect(suggestCategoryId(row({ description: "Pix recebido: UBER DO BRASIL", kind: "income", opType: "pix_received" }), [], list)).toBe("");
    expect(suggestCategoryId(row({ description: "Pix enviado: ESCLARECIDO LTDA", opType: "pix_sent" }), [], list)).toBe("");
  });
  it("não usa categoria arquivada", () => {
    expect(suggestCategoryId(row({ description: "Pix enviado: CLARO", opType: "pix_sent" }), [], list)).toBe("");
  });
  it("movimentações internas vão para a categoria do mesmo tipo", () => {
    expect(suggestCategoryId(row({ opType: "investment_apply", description: "Aplicacao: CDB" }), [], list)).toBe(cats.apply.id);
    expect(suggestCategoryId(row({ opType: "investment_redeem", kind: "income", description: "Resgate: CDB" }), [], list)).toBe(cats.redeemIn.id);
    expect(suggestCategoryId(row({ opType: "card_bill_payment", description: "Pagamento efetuado: fatura" }), [], list)).toBe(cats.card.id);
    expect(suggestCategoryId(row({ opType: "pix_received", kind: "income", selfTransfer: true, description: "Pix recebido: ANA" }), [], list)).toBe(cats.selfIn.id);
    expect(suggestCategoryId(row({ opType: "pix_sent", selfTransfer: true, description: "Pix enviado: ANA" }), [], list)).toBe(cats.selfOut.id);
  });
  it("sem categoria correspondente na lista, deixa em branco", () => {
    expect(suggestCategoryId(row({ description: "Compra no debito: COSTA ATACADAO" }), [], [])).toBe("");
  });
});

describe("linhas de importação a partir do extrato", () => {
  it("marca como duplicadas só as ocorrências já existentes e mantém as repetidas legítimas", () => {
    const rows = [row({ description: "Compra no debito: ZIGPAY", amount: "8.00" }), row({ description: "Compra no debito: ZIGPAY", amount: "8.00" }), row({ description: "Compra no debito: ZIGPAY", amount: "8.00" })];
    const existing = [{ date: "2026-02-01", amount: "8.00", description: "Compra no debito: ZIGPAY", kind: "expense", external_ref: null }];
    expect(rowsFromStatement(rows, [], list, existing).map((r) => r.duplicate)).toEqual([true, false, false]);
    expect(rowsFromStatement(rows, [], list, []).map((r) => r.duplicate)).toEqual([false, false, false]);
  });
  it("reimportar o mesmo extrato marca tudo como duplicado", () => {
    const rows = [row({ amount: "5.00" }), row({ amount: "5.00" }), row({ amount: "7.50", description: "Pix enviado: A" })];
    const existing = rows.map((r) => ({ ...r, external_ref: null }));
    const out = rowsFromStatement(rows, [], list, existing);
    expect(out.every((r) => r.duplicate && !r.include)).toBe(true);
  });
  it("valida data, valor e descrição", () => {
    const out = rowsFromStatement([row({ date: "2026-02-31" }), row({ amount: "0.00" }), row({ description: "" }), row({})], [], list, []);
    expect(out.map((r) => r.error)).toEqual(["Data inválida", "Valor inválido ou zero", "Descrição inválida", ""]);
    expect(out.map((r) => r.include)).toEqual([false, false, false, true]);
  });
  it("preenche os campos do formato de importação", () => {
    const [r] = rowsFromStatement([row({ description: "Pix enviado: UBER DO BRASIL TECNOLOGIA LTDA", opType: "pix_sent" })], [], list, []);
    expect(r).toMatchObject({ kind: "expense", categoryId: cats.uber.id, destinationAccountId: "", externalRef: "", recurringId: "", occurrenceDate: "", action: "reject", include: true });
  });
});

describe("consistência com as categorias padrão", () => {
  const names = (kind: string) => DEFAULT_CATEGORIES.filter((g) => g.kind === kind).flatMap((g) => g.children as readonly string[]);
  it("toda categoria sugerida existe nas categorias padrão de despesa", () => {
    for (const s of KEYWORD_SUGGESTIONS) expect(names("expense")).toContain(s.category);
  });
  it("as categorias de movimentação interna existem nos dois tipos certos", () => {
    expect(names("expense")).toEqual(expect.arrayContaining([NEUTRAL_CATEGORY.invest_apply, NEUTRAL_CATEGORY.card_bill, NEUTRAL_CATEGORY.self_transfer]));
    expect(names("income")).toEqual(expect.arrayContaining([NEUTRAL_CATEGORY.invest_redeem, NEUTRAL_CATEGORY.self_transfer]));
  });
});

describe("envio do PDF", () => {
  it("converte o arquivo em base64 sem perder bytes", async () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 251);
    const b64 = await fileToBase64(new Blob([bytes]));
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(back.length).toBe(70000);
    expect(back[69999]).toBe(69999 % 251);
  });
});
