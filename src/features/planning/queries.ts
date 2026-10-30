import { queryOptions } from '@tanstack/react-query';
import { listPlanning } from './planning.functions';
export const planningQuery=()=>queryOptions({queryKey:['planning'],queryFn:()=>listPlanning()});
