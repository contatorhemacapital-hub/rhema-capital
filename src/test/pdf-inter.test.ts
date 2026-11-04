import { describe, it, expect } from "vitest";
import { parseInterStatement, isInterStatement, moneyToCents, centsToAmount, normalizeName } from "@/features/imports/pdf-inter";

const FOOTER = "Fale com a gente\nSAC: 0800 940 9999 (opção 09) Ouvidoria: 0800 940 7772 Deficiência de fala e audição: 0800 979 7099";

// Extrato fictício no mesmo formato do Banco Inter. Saldo inicial derivado: R$ 1.000,00.
function fixture(overrides: { closing1?: string; line2Balance?: string; columnTitle?: boolean } = {}): string[] {
  const closing1 = overrides.closing1 ?? "R$ 1.180,00";
  const line2Balance = overrides.line2Balance ?? "R$ 880,00";
  const title = overrides.columnTitle === false ? "" : "Valor Saldo por transação";
  const page1 = [
    "Solicitado em: 01/03/2026 - 10h00",
    "ANA TESTE SOUZA",
    "CPF/CNPJ: 000.000.000-00, Instituição: Banco Inter, Agência: 0001-9, Conta: 1234567-8",
    "Período: 01/02/2026 a 03/02/2026",
    "Saldo total",
    "R$ 0,00",
    "(bloqueado + disponível)",
    `${title}1 de Fevereiro de 2026 Saldo do dia: ${closing1}`,
    'Compra no debito: "No estabelecimento MERCADO CENTRAL" -R$ 100,00 R$ 900,00',
    'Pix enviado: "Cp :12345678-UBER DO BRASIL',
    `TECNOLOGIA LTDA" -R$ 20,00 ${line2Balance}`,
    'Pix recebido: "Cp :87654321-Ana Teste Souza" R$ 300,00 R$ 1.180,00',
    FOOTER,
  ].join("\n");
  const page2 = [
    "2 de Fevereiro de 2026 Saldo do dia: R$ 10,80",
    "CONSORCIO -R$ 223,00 R$ 957,00",
    'Resgate: "CDB CREDITO BANCO INTER S A" R$ 50,00 R$ 1.007,00',
    'Pagamento efetuado: "Pagamento fatura cartao Inter" -R$ 1.000,00 R$ 7,00',
    "Estorno Compra cartao R$ 3,80 R$ 10,80",
    "3 de Fevereiro de 2026 Saldo do dia: R$ 0,00",
    'Pagamento efetuado: "Pagamento fatura cartao Inter" -R$ 10,80 -R$ 0,00',
    FOOTER,
  ].join("\n");
  return [page1, page2];
}

describe("leitor de extrato Inter em PDF", () => {
  it("reconhece o formato e rejeita outros bancos", () => {
    expect(isInterStatement(fixture().join("\n"))).toBe(true);
    expect(() => parseInterStatement("Banco Qualquer\nExtrato\n01/02/2026 compra 10,00")).toThrow(/não reconhecido/);
  });

  it("lê todos os lançamentos, inclusive o primeiro dia com o título da coluna colado", () => {
    const st = parseInterStatement(fixture());
    expect(st.rows).toHaveLength(8);
    expect(st.rows[0]).toMatchObject({ date: "2026-02-01", kind: "expense", amount: "100.00", description: "Compra no debito: MERCADO CENTRAL" });
    expect(st.rows.map((r) => r.date)).toEqual(["2026-02-01", "2026-02-01", "2026-02-01", "2026-02-02", "2026-02-02", "2026-02-02", "2026-02-02", "2026-02-03"]);
  });

  it("junta descrição quebrada em duas linhas e limpa o código do Pix", () => {
    const row = parseInterStatement(fixture()).rows[1]!;
    expect(row.description).toBe("Pix enviado: UBER DO BRASIL TECNOLOGIA LTDA");
    expect(row.opType).toBe("pix_sent");
    expect(row.amount).toBe("20.00");
  });

  it("lê linhas sem dois-pontos nem aspas e valores com milhar", () => {
    const rows = parseInterStatement(fixture()).rows;
    expect(rows[3]).toMatchObject({ description: "CONSORCIO", kind: "expense", amount: "223.00", opType: "other" });
    expect(rows[5]).toMatchObject({ amount: "1000.00", opType: "card_bill_payment" });
    expect(rows[6]).toMatchObject({ description: "Estorno Compra cartao", kind: "income", amount: "3.80", opType: "refund" });
  });

  it("classifica operações e detecta transferência para o próprio titular", () => {
    const rows = parseInterStatement(fixture()).rows;
    expect(rows.map((r) => r.opType)).toEqual(["debit_purchase", "pix_sent", "pix_received", "other", "investment_redeem", "card_bill_payment", "refund", "card_bill_payment"]);
    expect(rows.map((r) => r.selfTransfer)).toEqual([false, false, true, false, false, false, false, false]);
  });

  it("aceita saldo negativo zero e confere toda a cadeia de saldos", () => {
    const st = parseInterStatement(fixture());
    expect(st.balanceMismatches).toEqual([]);
    expect(st.dayMismatches).toEqual([]);
    expect(st.orphanRecords).toBe(0);
    expect(st.warnings).toEqual([]);
    expect(st.headerBalanceCents).toBe(0);
    expect(st.headerBalanceMatches).toBe(true);
    expect(st.holder).toBe("ANA TESTE SOUZA");
    expect([st.periodStart, st.periodEnd]).toEqual(["2026-02-01", "2026-02-03"]);
  });

  it("detecta saldo de linha que não fecha com a anterior", () => {
    const st = parseInterStatement(fixture({ line2Balance: "R$ 870,00" }));
    expect(st.balanceMismatches.length).toBeGreaterThan(0);
    expect(st.balanceMismatches[0]).toMatchObject({ date: "2026-02-01", expectedCents: 88000, gotCents: 87000 });
  });

  it("detecta 'Saldo do dia' diferente do último saldo do dia", () => {
    const st = parseInterStatement(fixture({ closing1: "R$ 1.100,00" }));
    expect(st.dayMismatches).toEqual([{ date: "2026-02-01", expectedCents: 110000, gotCents: 118000 }]);
  });

  it("não perde o primeiro dia mesmo sem o título da coluna", () => {
    const st = parseInterStatement(fixture({ columnTitle: false }));
    expect(st.rows).toHaveLength(8);
  });

  it("lida com o rodapé do banco colado à data do dia seguinte", () => {
    const pages = fixture();
    const glued = pages[1]!.replace(
      "2 de Fevereiro de 2026 Saldo do dia",
      "SAC: 0800 940 9999 (opção 09) Ouvidoria: 0800 940 7772 Deficiência de fala e audição: 0800 979 70992 de Fevereiro de 2026 Saldo do dia",
    );
    const st = parseInterStatement([pages[0]!, glued]);
    expect(st.rows).toHaveLength(8);
    expect(st.balanceMismatches).toEqual([]);
  });

  it("avisa quando há linhas com cara de lançamento antes de qualquer data", () => {
    const pages = fixture().map((p) => p.replace(/1 de Fevereiro de 2026 Saldo do dia: R\$ 1\.180,00/, "Cabeçalho ilegível"));
    const st = parseInterStatement(pages);
    expect(st.orphanRecords).toBeGreaterThan(0);
    expect(st.warnings.join(" ")).toMatch(/ignoradas/);
  });

  it("entende meses com acento", () => {
    const text = fixture().join("\n").replace(/Fevereiro/g, "Março").replace(/01\/02\/2026 a 03\/02\/2026/, "01/03/2026 a 03/03/2026");
    expect(parseInterStatement(text).rows[0]?.date).toBe("2026-03-01");
  });

  it("converte valores em centavos e de volta", () => {
    expect(moneyToCents("-R$ 1.550,00")).toBe(-155000);
    expect(moneyToCents("R$ 0,03")).toBe(3);
    expect(centsToAmount(-155000)).toBe("1550.00");
    expect(centsToAmount(5)).toBe("0.05");
    expect(normalizeName("  Ana Teste-Souza ")).toBe("ANA TESTE SOUZA");
  });
});
