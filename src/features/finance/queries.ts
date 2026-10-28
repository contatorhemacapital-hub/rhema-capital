import { queryOptions } from "@tanstack/react-query";
import { listAccounts, listCategories, listTransactions } from "./finance.functions";
import type { TxFilters } from "./schemas";

export const accountsQuery = () => queryOptions({ queryKey: ["accounts"], queryFn: () => listAccounts() });
export const categoriesQuery = () => queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
export const transactionsQuery = (f: TxFilters) =>
  queryOptions({ queryKey: ["transactions", f], queryFn: () => listTransactions({ data: f }) });

export const FINANCE_KEYS = [["accounts"], ["transactions"], ["categories"]] as const;
