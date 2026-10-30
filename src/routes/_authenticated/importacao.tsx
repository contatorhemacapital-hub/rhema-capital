import { createFileRoute } from '@tanstack/react-router';
import { ImportPage } from '@/features/imports/import-page';
import { importSettingsQuery } from '@/features/imports/queries';
import { planningQuery } from '@/features/planning/queries';
import { accountsQuery,categoriesQuery } from '@/features/finance/queries';
import { ErrorState,LoadingState,EmptyState } from '@/components/states';
export const Route=createFileRoute('/_authenticated/importacao')({head:()=>({meta:[{title:'Importação CSV — Rhema Capital'},{name:'description',content:'Revisão de extratos CSV, categorias e conciliação de previstos.'},{property:'og:title',content:'Importação CSV — Rhema Capital'},{property:'og:description',content:'Importação e conciliação financeira pessoal.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),loader:({context})=>Promise.all([context.queryClient.ensureQueryData(importSettingsQuery()),context.queryClient.ensureQueryData(planningQuery()),context.queryClient.ensureQueryData(accountsQuery()),context.queryClient.ensureQueryData(categoriesQuery())]),pendingComponent:LoadingState,errorComponent:({error})=><ErrorState error={error}/>,notFoundComponent:()=> <EmptyState title="Página não encontrada"/>,component:ImportPage});
