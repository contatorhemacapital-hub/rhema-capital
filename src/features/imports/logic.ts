import Papa from 'papaparse';
import { z } from 'zod';
import { parseMoneyInput, toCents, fromCents } from '@/features/finance/money';
import { validDate, type Occurrence } from '@/features/planning/logic';
export const mappingSchema=z.object({date:z.number().int().min(0),description:z.number().int().min(0),amount:z.number().int().min(-1),debit:z.number().int().min(-1),credit:z.number().int().min(-1),externalRef:z.number().int().min(-1),delimiter:z.enum([';',',']),dateFormat:z.enum(['br','iso'])}).refine(m=>m.amount>=0||(m.debit>=0&&m.credit>=0),'Mapeie valor ou débito/crédito');
export type Mapping=z.infer<typeof mappingSchema>;
export type Rule={id:string;term:string;category_id:string};
export type ImportRow={date:string;description:string;amount:string;kind:'income'|'expense'|'transfer';categoryId:string;destinationAccountId:string;externalRef:string;error:string;duplicate:boolean;include:boolean;recurringId:string;occurrenceDate:string;action:'auto'|'adjust'|'month'|'reject'|'unresolved'};
export function normalize(s:string){return s.toLocaleLowerCase('pt-BR').trim().replace(/\s+/g,' ');}
export function readCsv(text:string,delimiter?:';'|','){const parsed=Papa.parse<string[]>(text.replace(/^\uFEFF/,''),{delimiter,skipEmptyLines:'greedy'});if(parsed.errors.length)throw new Error(`CSV inválido: ${parsed.errors[0]?.message}`);const [headers,...rows]=parsed.data;if(!headers||!rows.length)throw new Error('Arquivo vazio');if(rows.length>2000)throw new Error('Limite de 2000 linhas por arquivo');return {headers,rows,delimiter:parsed.meta.delimiter as ';'|','};}
export function fingerprint(r:{date:string;amount:number|string;description:string;kind:string}){return `${r.date}|${toCents(r.amount)}|${r.kind}|${normalize(r.description)}`;}
export function mapRows(rows:string[][],m:Mapping,rules:Rule[],categories:{id:string;kind:string;archived_at:string|null}[],existing:{date:string;amount:number|string;description:string;kind:string;external_ref:string|null}[]):ImportRow[]{
 const seen=new Set(existing.map(fingerprint));const refs=new Set(existing.map(t=>t.external_ref).filter(Boolean));
 return rows.map(c=>{let error='';const raw=c[m.date]?.trim()??'';let date=raw;
 if(m.dateFormat==='br'){const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);date=match?`${match[3]}-${match[2]}-${match[1]}`:'';}
 if(!validDate.safeParse(date).success)error='Data inválida';
 const money=(i:number)=>i<0||!c[i]?.trim()?'0.00':parseMoneyInput(c[i]??'');
 let signed:string|null=null;
 if(m.amount>=0)signed=money(m.amount);else{const d=money(m.debit),cr=money(m.credit);if(d!==null&&cr!==null){if(toCents(d)!==0&&toCents(cr)!==0)error='Débito e crédito na mesma linha';signed=fromCents(Math.abs(toCents(cr))-Math.abs(toCents(d)));}}
 if(signed===null||toCents(signed)===0)error='Valor inválido ou zero';
 const kind= signed&&toCents(signed)>0?'income':'expense';const amount=signed?fromCents(Math.abs(toCents(signed))):'0.00';const description=c[m.description]?.trim()??'';
 if(!description||description.length>200)error='Descrição inválida';
 const externalRef=m.externalRef>=0?c[m.externalRef]?.trim()??'':'';
 const categoryId=[...rules].sort((a,b)=>b.term.length-a.term.length).find(r=>normalize(description).includes(normalize(r.term))&&categories.some(cat=>cat.id===r.category_id&&cat.kind===kind&&!cat.archived_at))?.category_id??'';
 const fp=fingerprint({date,description,amount,kind});const duplicate=seen.has(fp)||Boolean(externalRef&&refs.has(externalRef));seen.add(fp);if(externalRef)refs.add(externalRef);
 return {date,description,amount,kind,categoryId,destinationAccountId:'',externalRef,error,duplicate,include:!duplicate&&!error,recurringId:'',occurrenceDate:'',action:'reject'};
 });
}
function similar(a:string,b:string){const x=normalize(a),y=normalize(b);if(x.includes(y)||y.includes(x))return true;const tokens=x.split(/\W+/).filter(t=>t.length>3);return tokens.some(t=>y.includes(t));}
export function suggestMatches(rows:ImportRow[],expected:Occurrence[],accountId:string){const used=new Set<string>();return rows.map(row=>{if(row.duplicate||row.error||row.kind==='transfer')return {...row,recurringId:'',occurrenceDate:'',action:'reject' as const};const candidates=expected.filter(o=>o.accountId===accountId&&o.kind===row.kind&&o.status!=='conciliada'&&!used.has(o.key)&&o.categoryId===row.categoryId&&Math.abs(Date.parse(o.due)-Date.parse(row.date))<=7*86400000&&similar(row.description,o.description));if(candidates.length!==1)return {...row,recurringId:'',occurrenceDate:'',action:'reject' as const};const o=candidates[0];if(!o)return row;used.add(o.key);return {...row,recurringId:o.recurringId,occurrenceDate:o.due,action:toCents(row.amount)===toCents(o.amount)?'auto' as const:'unresolved' as const};});}
export function divergencePercent(expected:number,actual:string){return ((toCents(actual)-toCents(expected))/toCents(expected)*100).toFixed(1).replace('.',',');}
export const importRowSchema=z.object({date:validDate,description:z.string().trim().min(1).max(200),amount:z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).refine(s=>toCents(s)>0),kind:z.enum(['income','expense','transfer']),categoryId:z.string().uuid().or(z.literal('')),destinationAccountId:z.string().uuid().or(z.literal('')),externalRef:z.string().max(200),recurringId:z.string().uuid().or(z.literal('')),occurrenceDate:validDate.or(z.literal('')),action:z.enum(['auto','adjust','month','reject'])}).superRefine((r,c)=>{if(r.kind!=='transfer'&&!r.categoryId)c.addIssue({code:'custom',message:'Revise as linhas sem categoria'});if(r.kind==='transfer'&&!r.destinationAccountId)c.addIssue({code:'custom',message:'Escolha a outra conta do resgate/transferência'});if(r.recurringId&&!r.occurrenceDate)c.addIssue({code:'custom',message:'Ocorrência inválida'});});
