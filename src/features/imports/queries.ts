import { queryOptions } from '@tanstack/react-query';
import { listImportSettings } from './imports.functions';
export const importSettingsQuery=()=>queryOptions({queryKey:['imports'],queryFn:()=>listImportSettings()});
