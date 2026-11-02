import { queryOptions } from '@tanstack/react-query';
import { listPlanning } from './planning.functions';
export const planningQuery=(clientId:string)=>queryOptions({queryKey:['planning',clientId],queryFn:()=>listPlanning({data:{clientId}})});
