import { mapRows, mappingSchema, normalize, readCsv, type Mapping, type Rule } from "@/features/imports/logic";

const mapping: Mapping={date:0,description:1,amount:2,debit:-1,credit:-1,externalRef:-1,delimiter:";",dateFormat:"br"};
const cats=[{id:"cat-exp",kind:"expense",archived_at:null},{id:"cat-inc",kind:"income",archived_at:null},{id:"cat-old",kind:"expense",archived_at:"2026-01-01"}];
const map=(row:string[],m:Mapping=mapping,rules:Rule[]=[])=>mapRows([row],m,rules,cats,[])[0]!;

describe("importação CSV",()=>{
  it("detecta delimitador e remove BOM",()=>{
    expect(readCsv("\uFEFFdata;descricao;valor\n01/02/2026;Mercado;-45,90")).toMatchObject({headers:["data","descricao","valor"],delimiter:";"});
    expect(readCsv("data,descricao,valor\n01/02/2026,Mercado,-45.90").delimiter).toBe(",");
  });
  it("rejeita somente cabeçalho e limita 2000 registros",()=>{
    expect(()=>readCsv("data;descricao;valor")).toThrow(/Arquivo vazio/);
    const row="01/02/2026;Mercado;1,00";
    expect(readCsv("data;descricao;valor\n"+Array(2000).fill(row).join("\n")).rows).toHaveLength(2000);
    expect(()=>readCsv("data;descricao;valor\n"+Array(2001).fill(row).join("\n"))).toThrow(/Limite de 2000/);
  });
  it.each([["01/02/2026","2026-02-01",""],["31/02/2026",null,"Data inválida"],["29/02/2024","2024-02-29",""],["29/02/2025",null,"Data inválida"],["2026-02-01",null,"Data inválida"]] as const)("valida data %s", (date,expected,error)=>{
    const r=map([date,"Mercado","10,00"]);
    if(expected!==null) expect(r.date).toBe(expected);
    expect(r.error).toBe(error);
  });
  it.each([["-45,90","expense","45.90"],["1.234,56","income","1234.56"]] as const)("mapeia valor %s", (value,kind,amount)=>{
    expect(map(["01/02/2026","Movimento",value])).toMatchObject({kind,amount,error:""});
  });
  it("marca valor zero como inválido",()=>expect(map(["01/02/2026","Mercado","0,00"]).error).toBe("Valor inválido ou zero"));
  it("mapeia débito e crédito",()=>{
    const m={...mapping,amount:-1,debit:2,credit:3};
    expect(map(["01/02/2026","Compra","50,00",""],m)).toMatchObject({kind:"expense",amount:"50.00"});
    expect(map(["01/02/2026","Venda","","80,00"],m)).toMatchObject({kind:"income",amount:"80.00"});
    expect(map(["01/02/2026","Ambos","50,00","80,00"],m).error).toBe("Débito e crédito na mesma linha");
  });
  it("valida descrição vazia ou longa",()=>{
    expect(map(["01/02/2026","","1,00"]).error).toBe("Descrição inválida");
    expect(map(["01/02/2026","x".repeat(201),"1,00"]).error).toBe("Descrição inválida");
  });
  it("normaliza texto sem distinguir caixa e espaços",()=>expect(normalize("  CAFÉ   Central ")).toBe("café central"));
  it("prioriza o termo mais longo e ignora categoria incompatível ou arquivada",()=>{
    const rules:Rule[]=[{id:"1",term:"uber",category_id:"cat-exp"},{id:"2",term:"uber eats",category_id:"cat-inc"},{id:"3",term:"taxi",category_id:"cat-old"}];
    expect(map(["01/02/2026","UBER EATS","1,00"],mapping,rules).categoryId).toBe("cat-inc");
    expect(map(["01/02/2026","taxi","1,00"],mapping,rules).categoryId).toBe("");
    expect(map(["01/02/2026","uber","-1,00"],mapping,rules).categoryId).toBe("cat-exp");
  });
  it("valida o schema do mapeamento com índices não usados em -1",()=>expect(mappingSchema.safeParse(mapping).success).toBe(true));
});
