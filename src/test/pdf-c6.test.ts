import { describe, it, expect } from "vitest";
import { parseC6Statement, isC6Statement } from "@/features/imports/pdf-c6";

const FOOTER = "1/3 C6 Bank • Av. Nove de Julho, 3186 - Jardim Paulista, São Paulo/SP";
const PAGE_HEAD = "Data\nda transação\nData\nde processamento Tipo Descrição Valor";

// Extrato fictício no formato do C6 Bank. Saldo inicial derivado: R$ 0,00.
// Há uma linha de 31/12 processada só em 04/01 (vira o ano) e uma descrição quebrada em duas linhas.
function fixture(o: { decIncome?: string; bal30?: string; exportBalance?: string; dropLastBalance?: boolean; dropDecHeader?: boolean; footerGlued?: boolean } = {}): string[] {
  const decHeader = `Dezembro 2026 ( 01/12/2026 - 31/12/2026 ) Entradas: ${o.decIncome ?? "R$ 1.500,00"} • Saídas: R$ 400,00`;
  const page1 = [
    "Extrato da conta",
    "12.345.678 MARIA TESTE SOUZA • CNPJ: 12.345.678/0001-00",
    "Agência: 1 • Conta: 000000000",
    "Exportado em 05/01/27 às 10:00",
    "Período da Exportação",
    "01/12/2026 a 05/01/2027",
    "Saldo no dia da exportação",
    o.exportBalance ?? "R$ 1.090,00",
    ...(o.dropDecHeader ? [] : [decHeader]),
    PAGE_HEAD,
    "29/12 29/12 Entradas RECEBIMENTO DE TED R$ 1.000,00",
    "29/12 29/12 Saída PIX Pix enviado para PADARIA TESTE -R$ 40,00",
    "Saldo contábil do dia 29/12/26 R$ 960,00",
    "30/12 30/12 Débito de Cartão MERCADO TESTE",
    "BRASILIA BRA -R$ 100,00",
    "30/12 30/12 Entradas DEPOSITO POR BOLETO R$ 500,00",
    `Saldo contábil do dia 30/12/26 ${o.bal30 ?? "R$ 1.360,00"}`,
    "31/12 04/01 Saída PIX Pix enviado para MARIA TESTE SOUZA -R$ 260,00",
    FOOTER,
  ].join("\n");
  const glue = o.footerGlued ? FOOTER : "";
  const page2 = [
    `${glue}${PAGE_HEAD.split("\n")[0]}`,
    "Janeiro 2027 ( 01/01/2027 - 05/01/2027 ) Entradas: R$ 10,00 • Saídas: R$ 20,00",
    "02/01 04/01 Débito de Cartão FARMACIA TESTE BRASILIA BRA -R$ 20,00",
    "04/01 04/01 Entrada PIX Pix recebido de Joao Teste R$ 10,00",
    ...(o.dropLastBalance ? [] : ["Saldo contábil do dia 04/01/27 R$ 1.090,00"]),
    "Informações sujeitas a alteração até o final do dia",
    "2/3 C6 Bank • Av. Nove de Julho, 3186 - Jardim Paulista, São Paulo/SP",
  ].join("\n");
  return [page1, page2];
}

describe("leitor de extrato C6 Bank em PDF", () => {
  it("reconhece o formato e rejeita outros", () => {
    expect(isC6Statement(fixture().join("\n"))).toBe(true);
    expect(() => parseC6Statement("Banco Inter\nSaldo do dia: R$ 1,00")).toThrow(/não reconhecido/);
  });

  it("lê todos os lançamentos, inclusive a descrição quebrada em duas linhas", () => {
    const st = parseC6Statement(fixture());
    expect(st.rows).toHaveLength(7);
    expect(st.rows[2]).toMatchObject({ date: "2026-12-30", kind: "expense", amount: "100.00", description: "Débito de cartão: MERCADO TESTE BRASILIA BRA", opType: "debit_purchase" });
  });

  it("usa a data da transação e respeita o ano do bloco mensal", () => {
    const rows = parseC6Statement(fixture()).rows;
    expect(rows.map((r) => r.date)).toEqual(["2026-12-29", "2026-12-29", "2026-12-30", "2026-12-30", "2026-12-31", "2027-01-02", "2027-01-04"]);
  });

  it("classifica operações, limpa o nome do Pix e detecta transferência para o próprio titular", () => {
    const rows = parseC6Statement(fixture()).rows;
    expect(rows.map((r) => r.opType)).toEqual(["ted_received", "pix_sent", "debit_purchase", "deposit", "pix_sent", "debit_purchase", "pix_received"]);
    expect(rows[1]!.description).toBe("Pix enviado: PADARIA TESTE");
    expect(rows[6]!.description).toBe("Pix recebido: Joao Teste");
    expect(rows.map((r) => r.selfTransfer)).toEqual([false, false, false, false, true, false, false]);
  });

  it("confere totais por mês e o saldo contábil por data de processamento", () => {
    const st = parseC6Statement(fixture());
    expect(st.problems).toEqual([]);
    expect(st.headerBalanceMatches).toBe(true);
    expect(st.openingBalanceCents).toBe(0);
    expect(st.openingDate).toBe("2026-12-29");
    expect([st.periodStart, st.periodEnd]).toEqual(["2026-12-01", "2027-01-05"]);
    expect(st.holder).toBe("12.345.678 MARIA TESTE SOUZA");
  });

  it("detecta total mensal de entradas que não fecha", () => {
    const st = parseC6Statement(fixture({ decIncome: "R$ 1.600,00" }));
    expect(st.problems.join(" ")).toMatch(/Total de entradas de Dezembro 2026 não fecha: extrato R\$ 1\.600,00, lido R\$ 1\.500,00/);
  });

  it("detecta saldo contábil que não fecha", () => {
    const st = parseC6Statement(fixture({ bal30: "R$ 1.300,00" }));
    expect(st.problems.join(" ")).toMatch(/Saldo contábil de 30\/12\/2026 não fecha: extrato R\$ 1\.300,00, calculado R\$ 1\.360,00/);
  });

  it("detecta saldo da exportação diferente do último saldo", () => {
    expect(parseC6Statement(fixture({ exportBalance: "R$ 5,00" })).headerBalanceMatches).toBe(false);
  });

  it("avisa de lançamentos depois do último saldo contábil", () => {
    const st = parseC6Statement(fixture({ dropLastBalance: true }));
    expect(st.problems.join(" ")).toMatch(/3 lançamento\(s\) depois do último saldo contábil/);
  });

  it("avisa de linhas ignoradas antes do primeiro mês", () => {
    const st = parseC6Statement(fixture({ dropDecHeader: true }));
    expect(st.problems.join(" ")).toMatch(/antes do primeiro mês foram ignoradas/);
  });

  it("lê a linha mesmo com o rodapé do banco colado à linha seguinte", () => {
    const st = parseC6Statement(fixture({ footerGlued: true }));
    expect(st.rows).toHaveLength(7);
    expect(st.problems).toEqual([]);
  });

  it("classifica tarifa, pagamento, devolução de Pix e meses com acento", () => {
    const text = [
      "Extrato da conta",
      "98.765.432 JOAO TESTE LTDA • CNPJ: 98.765.432/0001-00",
      "Período da Exportação",
      "01/03/2026 a 05/03/2026",
      "Saldo no dia da exportação",
      "R$ 88,00",
      "Março 2026 ( 01/03/2026 - 31/03/2026 ) Entradas: R$ 150,00 • Saídas: R$ 62,00",
      "02/03 02/03 Entradas RECEBIMENTO DE TED R$ 100,00",
      "02/03 02/03 Outros gastos TARIFA MANUTEN MEI -R$ 12,00",
      "02/03 02/03 Pagamento ACME LTDA -R$ 50,00",
      "Saldo contábil do dia 02/03/26 R$ 38,00",
      "03/03 03/03 Devolução PIX Devol recebida pix de LOJA X R$ 50,00",
      "Saldo contábil do dia 03/03/26 R$ 88,00",
    ].join("\n");
    const st = parseC6Statement(text);
    expect(st.problems).toEqual([]);
    expect(st.rows.map((r) => r.opType)).toEqual(["ted_received", "fee", "bill_payment", "pix_refund"]);
    expect(st.rows[3]).toMatchObject({ description: "Devolução Pix: LOJA X", kind: "income", date: "2026-03-03" });
    expect(st.rows[0]!.date).toBe("2026-03-02");
  });

  it("lê tipo desconhecido sem perder o lançamento", () => {
    const text = [
      "Extrato da conta", "1 TESTE • CNPJ: 1", "Saldo no dia da exportação", "R$ 5,00",
      "Abril 2026 ( 01/04/2026 - 30/04/2026 ) Entradas: R$ 5,00 • Saídas: R$ 0,00",
      "02/04 02/04 Rendimentos REMUNERACAO NOVA R$ 5,00",
      "Saldo contábil do dia 02/04/26 R$ 5,00",
    ].join("\n");
    const st = parseC6Statement(text);
    expect(st.rows).toHaveLength(1);
    expect(st.rows[0]).toMatchObject({ kind: "income", amount: "5.00" });
    expect(st.problems).toEqual([]);
  });
});
