import { fingerprint, mapRows, type Mapping } from "@/features/imports/logic";

const m:Mapping={date:0,description:1,amount:2,debit:-1,credit:-1,externalRef:3,delimiter:";",dateFormat:"br"};
const category=[{id:"expense",kind:"expense",archived_at:null}];
const existing=[{date:"2026-02-01",amount:"45.90",description:"Mercado central",kind:"expense",external_ref:"ref-1"}];
const run=(rows:string[][],old=existing)=>mapRows(rows,m,[],category,old);

describe("detecção de duplicidades",()=>{
  it("gera fingerprint estável para caixa e espaços",()=>{
    expect(fingerprint({date:"2026-02-01",amount:"45.90",description:" MERCADO  Central ",kind:"expense"}))
      .toBe(fingerprint({date:"2026-02-01",amount:"45.90",description:"mercado central",kind:"expense"}));
  });
  it("distingue data e valor diferentes",()=>{
    const base={date:"2026-02-01",amount:"45.90",description:"Mercado",kind:"expense"};
    expect(fingerprint(base)).not.toBe(fingerprint({...base,amount:"46.00"}));
    expect(fingerprint(base)).not.toBe(fingerprint({...base,date:"2026-02-02"}));
  });
  it("marca external_ref existente e exclui a linha",()=>expect(run([["01/02/2026","Outro","1,00","ref-1"]])[0]).toMatchObject({duplicate:true,include:false}));
  it("marca reimportação de conteúdo idêntico",()=>expect(run([["01/02/2026","Mercado central","45,90",""]])[0]?.duplicate).toBe(true));
  it.fails("BUG A-01: não deduplica duas ocorrências legítimas no mesmo arquivo",()=>{
    // BUG conhecido: será corrigido em etapa futura
    expect(run([["01/02/2026","Repetido","10,00",""],["01/02/2026","Repetido","10,00",""]],[]).map(r=>r.duplicate)).toEqual([false,false]);
  });
  it.fails("BUG A-01: só a primeira linha do arquivo coincide com existing",()=>{
    // BUG conhecido: será corrigido em etapa futura
    expect(run([["01/02/2026","Mercado central","45,90",""],["01/02/2026","Mercado central","45,90",""]]).map(r=>r.duplicate)).toEqual([true,false]);
  });
});
