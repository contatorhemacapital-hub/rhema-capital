import { queryOptions } from '@tanstack/react-query';
import { listImportSettings } from './imports.functions';
export const importSettingsQuery=(clientId:string)=>queryOptions({queryKey:['imports',clientId],queryFn:()=>listImportSettings({data:{clientId}})});
