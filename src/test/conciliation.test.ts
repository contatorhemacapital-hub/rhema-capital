import { suggestMatches, divergencePercent, type ImportRow } from "@/features/imports/logic";
import type { Occurrence } from "@/features/planning/logic";

const row=(overrides:Partial<ImportRow>={}):ImportRow=>({date:"2026-03-13",description:"Parcela consórcio Rhema",amount:"210.96",kind:"expense",categoryId:"cat",destinationAccountId:"",externalRef:"",error:"",duplicate:false,include:true,recurringId:"",occurrenceDate:"",action:"reject",...overrides});
const occurrence=(key="o1",overrides:Partial<Occurrence>={}):Occurrence=>({key,recurringId:"rec-1",due:"2026-03-10",competence:"2026-03-01",amount:210.96,description:"Parcela consórcio Rhema",kind:"expense",accountId:"acc",categoryId:"cat",status:"pendente",...overrides});

describe("conciliação de recorrências",()=>{
  it("vincula candidato único compatível",()=>{
    expect(suggestMatches([row()],[occurrence()],"acc")[0]).toMatchObject({action:"auto",recurringId:"rec-1",occurrenceDate:"2026-03-10"});
  });
  it("mantém divergência de valor sem conciliar automaticamente",()=>expect(suggestMatches([row({amount:"218.00"})],[occurrence()],"acc")[0]?.action).toBe("unresolved"));
  it("rejeita mais de um candidato",()=>expect(suggestMatches([row()],[occurrence("1"),occurrence("2")],"acc")[0]?.action).toBe("reject"));
  it.each([7,8])("avalia tolerância de %i dias",days=>{
    const date=days===7?"2026-03-17":"2026-03-18";
    expect(suggestMatches([row({date})],[occurrence()],"acc")[0]?.action).toBe(days===7?"auto":"reject");
  });
  it.each([
    [{categoryId:"other"},"categoria diferente"],
    [{kind:"income" as const},"tipo diferente"],
  ])("rejeita %s", (override)=>expect(suggestMatches([row()],[occurrence("o",{...override})],"acc")[0]?.action).toBe("reject"));
  it("rejeita conta divergente ou ocorrência conciliada",()=>{
    expect(suggestMatches([row()],[occurrence("o",{accountId:"other"})],"acc")[0]?.action).toBe("reject");
    expect(suggestMatches([row()],[occurrence("o",{status:"conciliada"})],"acc")[0]?.action).toBe("reject");
  });
  it("rejeita linha duplicada, inválida ou transferência",()=>{
    for(const item of [row({duplicate:true}),row({error:"inválida"}),row({kind:"transfer" as ImportRow["kind"]})])
      expect(suggestMatches([item],[occurrence()],"acc")[0]?.action).toBe("reject");
  });
  it("vincula a ocorrência somente uma vez",()=>{
    const result=suggestMatches([row(),row()],[occurrence()],"acc");
    expect(result[0]?.recurringId).toBe("rec-1"); expect(result[1]?.action).toBe("reject");
  });
  it("divergência retornada é textual com vírgula decimal",()=>{
    expect(divergencePercent(210.96,"218.00")).toBe("3,3");
  });
});
