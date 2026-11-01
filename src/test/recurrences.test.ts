import { expectedAmount, occurrences, recurringInput, type Adjustment, type Link, type Recurring } from "@/features/planning/logic";

const makeRecurring=(overrides:Partial<Recurring>={}):Recurring=>({id:"00000000-0000-4000-8000-000000000001",kind:"expense",description:"Parcela",category_id:"00000000-0000-4000-8000-000000000002",account_id:"00000000-0000-4000-8000-000000000003",amount:210.96,due_day:10,start_date:"2026-01-05",end_date:null,installment_count:null,frequency:"monthly",custom_dates:[],active:true,...overrides});
const run=(r:Recurring,links:Link[]=[])=>occurrences([r],[],links,"2026-01-01","2026-04-30","2026-03-15");

describe("ocorrências recorrentes",()=>{
  it("gera mensalidades e estados por data e tipo",()=>{
    expect(run(makeRecurring()).map(x=>[x.due,x.status])).toEqual([["2026-01-10","pendente"],["2026-02-10","pendente"],["2026-03-10","pendente"],["2026-04-10","prevista"]]);
    expect(run(makeRecurring({kind:"income"})).slice(0,3).map(x=>x.status)).toEqual(["atrasada","atrasada","atrasada"]);
  });
  it("ajusta dia 31 ao último dia de cada mês",()=>{
    const r=makeRecurring({due_day:31,start_date:"2026-01-01"});
    expect(occurrences([r],[],[],"2026-02-01","2028-04-30","2026-01-01").map(x=>x.due).filter(d=>d.endsWith("-02-28")||d.endsWith("-02-29")||d.endsWith("-04-30"))).toEqual(["2026-02-28","2026-04-30","2027-02-28","2027-04-30","2028-02-29","2028-04-30"]);
  });
  it("respeita quantidade de parcelas e data final",()=>{
    expect(occurrences([makeRecurring({start_date:"2026-01-01",installment_count:3})],[],[],"2026-01-01","2027-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-01-10","2026-02-10","2026-03-10"]);
    expect(occurrences([makeRecurring({end_date:"2026-03-31"})],[],[],"2026-01-01","2026-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-01-10","2026-02-10","2026-03-10"]);
  });
  it("trata frequência única e datas customizadas ordenadas sem repetição",()=>{
    expect(occurrences([makeRecurring({frequency:"once"})],[],[],"2026-01-01","2026-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-01-05"]);
    expect(occurrences([makeRecurring({frequency:"custom",custom_dates:["2026-03-10","2026-01-10","2026-01-10"]})],[],[],"2026-01-01","2026-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-01-10","2026-03-10"]);
  });
  it("ignora regra inativa e só concilia vínculo postado",()=>{
    expect(occurrences([makeRecurring({active:false})],[],[],"2026-01-01","2026-12-31","2026-01-01")).toEqual([]);
    const links:Link[]=[{recurring_id:"00000000-0000-4000-8000-000000000001",occurrence_date:"2026-02-10",status:"posted"}];
    expect(run(makeRecurring(),links).find(x=>x.due==="2026-02-10")?.status).toBe("conciliada");
    expect(run(makeRecurring(),links.map(x=>({...x,status:"cancelled"}))).find(x=>x.due==="2026-02-10")?.status).toBe("pendente");
  });
  it("BUG primeira parcela: começa no próximo vencimento após start_date",()=>{
    const r=makeRecurring({start_date:"2026-01-20",installment_count:1});
    expect(occurrences([r],[],[],"2026-01-01","2026-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-02-10"]);
  });
  it("BUG consórcio: conta parcelas a partir do primeiro vencimento",()=>{
    const r=makeRecurring({start_date:"2026-01-20",installment_count:12});
    const dates=occurrences([r],[],[],"2026-01-01","2027-12-31","2026-01-01").map(x=>x.due);
    expect(dates).toHaveLength(12); expect(dates[0]).toBe("2026-02-10"); expect(dates.at(-1)).toBe("2027-01-10");
  });
  it("conta três parcelas desde o vencimento do mês de início",()=>{
    const r=makeRecurring({start_date:"2026-01-05",due_day:10,installment_count:3});
    expect(occurrences([r],[],[],"2026-01-01","2026-12-31","2026-03-15").map(x=>x.due)).toEqual(["2026-01-10","2026-02-10","2026-03-10"]);
  });
  it("inclui vencimento igual à data de início",()=>{
    const r=makeRecurring({start_date:"2026-01-10",due_day:10,installment_count:2});
    expect(occurrences([r],[],[],"2026-01-01","2026-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-01-10","2026-02-10"]);
  });
  it("limita vencimento do dia 31 ao fim de fevereiro",()=>{
    const r=makeRecurring({start_date:"2026-01-31",due_day:31,installment_count:2});
    expect(occurrences([r],[],[],"2026-01-01","2026-12-31","2026-01-01").map(x=>x.due)).toEqual(["2026-01-31","2026-02-28"]);
  });
  it("mantém a numeração das parcelas ao consultar uma janela posterior",()=>{
    const r=makeRecurring({start_date:"2026-01-20",due_day:10,installment_count:3});
    expect(occurrences([r],[],[],"2026-03-01","2026-12-31","2026-03-15").map(x=>x.due)).toEqual(["2026-03-10","2026-04-10"]);
  });
  it("usa o valor vigente e, no empate de data efetiva, o created_at mais recente",()=>{
    const r=makeRecurring(); const history:Adjustment[]=[
      {id:"a",recurring_id:r.id,effective_from:"2026-04-01",previous_amount:210.96,new_amount:218,created_at:"2026-03-01T00:00:00Z"},
      {id:"b",recurring_id:r.id,effective_from:"2026-04-01",previous_amount:218,new_amount:220,created_at:"2026-03-02T00:00:00Z"},
    ];
    expect(expectedAmount(r,"2026-03-10",[history[0]!])).toBe(210.96);
    expect(expectedAmount(r,"2026-04-10",[history[0]!])).toBe(218);
    expect(expectedAmount(r,"2026-04-10",history)).toBe(220);
  });
  it("valida combinações e valores básicos de recurringInput",()=>{
    const base={kind:"expense",description:"Teste",category_id:"00000000-0000-4000-8000-000000000002",account_id:"00000000-0000-4000-8000-000000000003",amount:"10.00",due_day:10,start_date:"2026-01-01",end_date:null,installment_count:null,frequency:"monthly",custom_dates:[],active:true};
    expect(recurringInput.safeParse({...base,end_date:"2026-02-01",installment_count:3}).success).toBe(false);
    expect(recurringInput.safeParse({...base,start_date:"2026-02-01",end_date:"2026-01-31"}).success).toBe(false);
    expect(recurringInput.safeParse({...base,frequency:"custom"}).success).toBe(false);
    expect(recurringInput.safeParse({...base,amount:"0"}).success).toBe(false);
    expect(recurringInput.safeParse({...base,start_date:"2026-02-31"}).success).toBe(false);
  });
});
