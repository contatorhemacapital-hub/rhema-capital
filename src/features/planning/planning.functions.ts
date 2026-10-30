import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { recurringInput, type Recurring, type Adjustment } from './logic';
import { DEFAULT_CATEGORIES } from './defaults';
import { z } from 'zod';
function check(e:{message:string}|null){if(e)throw new Error(e.message);}
export const loadDefaults=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {data,error}=await context.supabase.rpc('load_default_categories',{p_groups:JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))});check(error);return {created:data??0};});
export const listPlanning=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const [r,h,l]=await Promise.all([context.supabase.from('recurring_items').select('*').order('description'),context.supabase.from('recurring_adjustments').select('*').order('created_at'),context.supabase.from('transactions').select('recurring_id,occurrence_date,status').not('recurring_id','is',null).neq('status','cancelled')]);check(r.error);check(h.error);check(l.error);return {items:(r.data??[]) as Recurring[],history:(h.data??[]) as Adjustment[],links:l.data??[]};
});
export const saveRecurring=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>recurringInput.parse(d)).handler(async({data,context})=>{
 const {id,...values}=data;const row={...values,amount:Number(values.amount),custom_dates:[...new Set(values.custom_dates)].sort()};
 if(id){const old=await context.supabase.from('recurring_items').select('amount').eq('id',id).single();check(old.error);if(old.data?.amount!==row.amount)throw new Error('Reajustes de valor devem ser confirmados na conciliação');}
 const q=id?context.supabase.from('recurring_items').update(row).eq('id',id).eq('owner_id',context.userId):context.supabase.from('recurring_items').insert({...row,owner_id:context.userId});const {data:rows,error}=await q.select('id');check(error);if(!rows?.length)throw new Error('Previsto não encontrado');return {ok:true};
});
export const deleteRecurring=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({id:z.string().uuid()}).parse(d)).handler(async({data,context})=>{const {error}=await context.supabase.from('recurring_items').delete().eq('id',data.id).eq('owner_id',context.userId);if(error)throw new Error('Previsto com histórico ou conciliação não pode ser excluído; desative-o.');return {ok:true};});
