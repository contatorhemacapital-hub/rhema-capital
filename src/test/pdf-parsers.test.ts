import { describe, it, expect } from "vitest";
import { parseBankStatement, statementIntegrityOk } from "@/features/imports/pdf-parsers";

const inter = [
  "Solicitado em: 01/03/2026 - 10h00",
  "ANA TESTE SOUZA",
  "CPF/CNPJ: 000.000.000-00, Instituição: Banco Inter, Agência: 0001-9, Conta: 1234567-8",
  "Período: 01/02/2026 a 01/02/2026",
  "Saldo total",
  "R$ 880,00",
  "Valor Saldo por transação1 de Fevereiro de 2026 Saldo do dia: R$ 880,00",
  'Compra no debito: "No estabelecimento MERCADO CENTRAL" -R$ 100,00 R$ 900,00',
  'Pix enviado: "Cp :12345678-PADARIA TESTE" -R$ 20,00 R$ 880,00',
].join("\n");

const c6 = [
  "Extrato da conta",
  "12.345.678 MARIA TESTE SOUZA • CNPJ: 12.345.678/0001-00",
  "Período da Exportação",
  "01/02/2026 a 03/02/2026",
  "Saldo no dia da exportação",
  "R$ 70,00",
  "Fevereiro 2026 ( 01/02/2026 - 28/02/2026 ) Entradas: R$ 100,00 • Saídas: R$ 30,00",
  "02/02 02/02 Entradas RECEBIMENTO DE TED R$ 100,00",
  "02/02 02/02 Saída PIX Pix enviado para PADARIA TESTE -R$ 30,00",
  "Saldo contábil do dia 02/02/26 R$ 70,00",
].join("\n");

describe("escolha do leitor por banco", () => {
  it("lê Banco Inter e informa o saldo antes do primeiro lançamento", () => {
    const st = parseBankStatement([inter]);
    expect(st.bank).toBe("inter");
    expect(st.rows).toHaveLength(2);
    expect(st.openingBalanceCents).toBe(100000);
    expect(st.openingDate).toBe("2026-02-01");
    expect(st.problems).toEqual([]);
    expect(statementIntegrityOk(st)).toBe(true);
  });

  it("lê C6 Bank e informa o saldo antes do primeiro lançamento", () => {
    const st = parseBankStatement([c6]);
    expect(st.bank).toBe("c6");
    expect(st.rows).toHaveLength(2);
    expect(st.openingBalanceCents).toBe(0);
    expect(statementIntegrityOk(st)).toBe(true);
  });

  it("traduz falhas de conferência do Inter em mensagens legíveis", () => {
    const broken = inter.replace("R$ 880,00\n", "R$ 870,00\n").replace("-R$ 20,00 R$ 880,00", "-R$ 20,00 R$ 870,00");
    const st = parseBankStatement([broken]);
    expect(st.problems.length).toBeGreaterThan(0);
    expect(st.problems.join(" ")).toMatch(/não fecha/);
    expect(statementIntegrityOk(st)).toBe(false);
  });

  it("rejeita bancos não suportados dizendo quais são suportados", () => {
    expect(() => parseBankStatement(["Banco Qualquer\nExtrato"])).toThrow(/Banco Inter e C6 Bank/);
  });
});
