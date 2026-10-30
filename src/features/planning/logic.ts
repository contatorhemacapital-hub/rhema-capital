import { z } from 'zod';
import { toCents } from '@/features/finance/money';
export const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d=new Date(`${s}T00:00:00Z`); return !Number.isNaN(+d) && d.toISOString().slice(0,10)===s; },'Data inválida');
export const recurringInput = z.object({id:z.string().uuid().optional(),kind:z.enum(['income','expense']),description:z.string().trim().min(1).max(200),category_id:z.string().uuid(),account_id:z.string().uuid(),amount:z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).refine(s=>toCents(s)>0),due_day:z.number().int().min(1).max(31),start_date:validDate,end_date:validDate.nullable(),installment_count:z.number().int().min(1).max(1200).nullable(),frequency:z.enum(['monthly','once','custom']),custom_dates:z.array(validDate).max(1200),active:z.boolean()}).superRefine((r,c)=>{
 if(r.end_date && r.installment_count)c.addIssue({code:'custom',message:'Escolha data final ou parcelas',path:['end_date']});
 if(r.end_date && r.end_date<r.start_date)c.addIssue({code:'custom',message:'Término anterior ao início',path:['end_date']});
 if(r.frequency==='custom' && (!r.custom_dates.length || r.custom_dates.some(d=>d<r.start_date || (r.end_date && d>r.end_date))))c.addIssue({code:'custom',message:'Datas avulsas inválidas',path:['custom_dates']});
});
export type Recurring = Omit<z.infer<typeof recurringInput>,'id'|'amount'> & {id:string;amount:number};
export type Adjustment = {id:string;recurring_id:string;effective_from:string;previous_amount:number;new_amount:number;created_at:string};
export type Link = {recurring_id:string|null;occurrence_date:string|null;status:string};
export type Occurrence = {key:string;recurringId:string;due:string;competence:string;amount:number;description:string;kind:'income'|'expense';accountId:string;categoryId:string;status:'prevista'|'conciliada'|'atrasada'|'pendente'};
export function expectedAmount(r:Recurring,due:string,history:Adjustment[]) {
 const h=history.filter(a=>a.recurring_id===r.id).sort((a,b)=>a.effective_from.localeCompare(b.effective_from)||a.created_at.localeCompare(b.created_at));
 return [...h].reverse().find(a=>a.effective_from<=due)?.new_amount ?? h[0]?.previous_amount ?? r.amount;
}
export function occurrences(items:Recurring[],history:Adjustment[],links:Link[],from:string,to:string,today:string):Occurrence[]{
 const out:Occurrence[]=[];
 for(const r of items){if(!r.active)continue; let dates:string[]=[];
 if(r.frequency==='once')dates=[r.start_date];
 else if(r.frequency==='custom')dates=[...new Set(r.custom_dates)].sort().slice(0,r.installment_count??1200);
 else {const start=new Date(`${r.start_date.slice(0,7)}-01T00:00:00Z`);for(let i=0;i<(r.installment_count??1200);i++){const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1));if(d.toISOString().slice(0,10)>to)break;const day=Math.min(r.due_day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate());dates.push(`${d.toISOString().slice(0,7)}-${String(day).padStart(2,'0')}`);}}
 for(const due of dates){if(due<r.start_date||due<from||due>to||(r.end_date&&due>r.end_date))continue;
 const matched=links.some(l=>l.recurring_id===r.id&&l.occurrence_date===due&&l.status==='posted');
 out.push({key:`${r.id}:${due}`,recurringId:r.id,due,competence:`${due.slice(0,7)}-01`,amount:expectedAmount(r,due,history),description:r.description,kind:r.kind,accountId:r.account_id,categoryId:r.category_id,status:matched?'conciliada':due<today?(r.kind==='income'?'atrasada':'pendente'):'prevista'});
 }} return out.sort((a,b)=>a.due.localeCompare(b.due)||a.description.localeCompare(b.description));
}
