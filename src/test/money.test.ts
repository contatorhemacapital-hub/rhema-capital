import { accountBalanceCents, effectOn, fromCents, parseMoneyInput, summarize, toCents } from "@/features/finance/money";

describe("regras monetárias em centavos", () => {
  it.each([["1234.56",123456],["0.5",50],["-10",-1000],[12.3,1230]] as const)("converte %s para %i centavos", (input, expected) => expect(toCents(input)).toBe(expected));
  it("rejeita formatos inválidos", () => {
    expect(() => toCents("abc")).toThrow(/Valor inválido/);
    expect(() => toCents("1,50")).toThrow();
  });
  it.each([[123456,"1234.56"],[-5,"-0.05"],[0,"0.00"]] as const)("formata %i centavos", (input, expected) => expect(fromCents(input)).toBe(expected));
  it.each([["1.234,56","1234.56"],["R$ 1.234,56","1234.56"],["1234.56","1234.56"],["10,5","10.50"],["-45,90","-45.90"]] as const)("interpreta %s", (input, expected) => expect(parseMoneyInput(input)).toBe(expected));
  it.each(["","abc","1,234,56","1.234"])("retorna null para %s", input => expect(parseMoneyInput(input)).toBeNull());
  it("calcula os efeitos por conta e situação", () => {
    const base = { account_id:"conta-a", destination_account_id:null, amount:"25.00" };
    expect(effectOn({...base,kind:"income",status:"posted"},"conta-a")).toBe(2500);
    expect(effectOn({...base,kind:"expense",status:"posted"},"conta-a")).toBe(-2500);
    expect(effectOn({...base,kind:"expense",status:"pending"},"conta-a")).toBe(0);
    expect(effectOn({...base,kind:"expense",status:"cancelled"},"conta-a")).toBe(0);
    const transfer={...base,kind:"transfer" as const,status:"posted" as const,destination_account_id:"conta-b"};
    expect(effectOn(transfer,"conta-a")).toBe(-2500);
    expect(effectOn(transfer,"conta-b")).toBe(2500);
    expect(effectOn(transfer,"outra")).toBe(0);
  });
  it("calcula saldo com lançamentos postados e transferência", () => {
    const txs=[
      {kind:"income" as const,status:"posted" as const,account_id:"conta",destination_account_id:null,amount:"50.00"},
      {kind:"expense" as const,status:"posted" as const,account_id:"conta",destination_account_id:null,amount:"20.00"},
      {kind:"expense" as const,status:"pending" as const,account_id:"conta",destination_account_id:null,amount:"10.00"},
      {kind:"transfer" as const,status:"posted" as const,account_id:"conta",destination_account_id:"outra",amount:"30.00"},
    ];
    expect(accountBalanceCents("100.00",txs,"conta")).toBe(10000);
  });
  it("ignora transferências no resumo e conta pendências em quantidade", () => {
    expect(summarize([
      {kind:"income",status:"posted",account_id:"a",destination_account_id:null,amount:"50.00"},
      {kind:"expense",status:"posted",account_id:"a",destination_account_id:null,amount:"20.00"},
      {kind:"expense",status:"pending",account_id:"a",destination_account_id:null,amount:"500.00"},
      {kind:"transfer",status:"posted",account_id:"a",destination_account_id:"b",amount:"99.00"},
    ])).toEqual({income:5000,expense:2000,net:3000,pending:1});
  });
});
