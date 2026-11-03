import { queryOptions } from "@tanstack/react-query";
import { listAccounts, listCategories, listTransactions } from "./finance.functions";
import type { TxFilters } from "./schemas";

export const accountsQuery = (clientId: string) =>
  queryOptions({ queryKey: ["accounts", clientId], queryFn: () => listAccounts({ data: { clientId } }) });
export const categoriesQuery = (clientId: string) =>
  queryOptions({ queryKey: ["categories", clientId], queryFn: () => listCategories({ data: { clientId } }) });
export const transactionsQuery = (clientId: string, f: TxFilters) =>
  queryOptions({ queryKey: ["transactions", clientId, f], queryFn: () => listTransactions({ data: { ...f, clientId } }) });

export const FINANCE_KEYS = [["accounts"], ["transactions"], ["categories"]] as const;
