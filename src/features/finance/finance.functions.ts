import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  accountInput,
  archiveInput,
  cancelInput,
  categoryInput,
  idInput,
  transactionInput,
  txFilters,
} from "./schemas";

// All functions: identity verified by requireSupabaseAuth, queries run as the user
// (RLS + is_owner() in the database), owner_id is always taken from the session.

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message.replace(/^.*?ERROR:\s*/, ""));
}

export type Account = {
  account_id: string;
  name: string;
  type: string;
  currency: string;
  archived_at: string | null;
  opening_balance: number;
  opening_date: string;
  income_posted: number;
  expense_posted: number;
  transfer_in: number;
  transfer_out: number;
  pending_net: number;
  balance: number;
  institution: string | null;
};

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [bal, acc] = await Promise.all([
      context.supabase.from("account_balances").select("*").order("name"),
      context.supabase.from("financial_accounts").select("id, institution"),
    ]);
    check(bal.error);
    check(acc.error);
    const inst = new Map((acc.data ?? []).map((a) => [a.id, a.institution]));
    return (bal.data ?? []).map((b) => ({ ...b, institution: inst.get(b.account_id!) ?? null })) as Account[];
  });

export const saveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => accountInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      name: data.name,
      institution: data.institution || null,
      type: data.type,
      opening_balance: Number(data.openingBalance),
      opening_date: data.openingDate,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("financial_accounts")
        .update(row)
        .eq("id", data.id)
        .eq("owner_id", context.userId);
      check(error);
    } else {
      const { error } = await context.supabase.from("financial_accounts").insert({ ...row, owner_id: context.userId });
      check(error);
    }
    return { ok: true };
  });

export const setAccountArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => archiveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financial_accounts")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    check(error);
    return { ok: true };
  });

export type Category = {
  id: string;
  name: string;
  kind: "income" | "expense";
  parent_id: string | null;
  archived_at: string | null;
};

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("categories")
      .select("id, name, kind, parent_id, archived_at")
      .order("name");
    check(error);
    return (data ?? []) as Category[];
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => categoryInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = { name: data.name, kind: data.kind, parent_id: data.parentId ?? null };
    const q = data.id
      ? context.supabase.from("categories").update(row).eq("id", data.id).eq("owner_id", context.userId)
      : context.supabase.from("categories").insert({ ...row, owner_id: context.userId });
    const { error } = await q;
    check(error);
    return { ok: true };
  });

export const setCategoryArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => archiveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("categories")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    check(error);
    return { ok: true };
  });

export type Transaction = {
  id: string;
  kind: "income" | "expense" | "transfer";
  status: "pending" | "posted" | "cancelled";
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  amount: number;
  date: string;
  description: string;
  notes: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txFilters.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("transactions")
      .select(
        "id, kind, status, account_id, destination_account_id, category_id, amount, date, description, notes, cancelled_at, cancel_reason",
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.status) q = q.eq("status", data.status);
    if (data.accountId) q = q.or(`account_id.eq.${data.accountId},destination_account_id.eq.${data.accountId}`);
    if (data.categoryId) {
      const { data: kids, error } = await context.supabase.from("categories").select("id").eq("parent_id", data.categoryId);
      check(error);
      q = q.in("category_id", [data.categoryId, ...(kids ?? []).map((k) => k.id)]);
    }
    if (data.q) q = q.ilike("description", `%${data.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const { data: rows, error } = await q;
    check(error);
    return (rows ?? []) as Transaction[];
  });

export const saveTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => transactionInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      status: data.status,
      account_id: data.accountId,
      destination_account_id: data.kind === "transfer" ? data.destinationAccountId! : null,
      category_id: data.kind === "transfer" ? null : data.categoryId!,
      amount: Number(data.amount),
      date: data.date,
      description: data.description,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("transactions")
        .update(row)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .eq("kind", data.kind);
      check(error);
    } else {
      const { error } = await context.supabase
        .from("transactions")
        .insert({ ...row, kind: data.kind, owner_id: context.userId });
      check(error);
    }
    return { ok: true };
  });

export const cancelTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("transactions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: data.reason })
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .neq("status", "cancelled")
      .select("id");
    check(error);
    if (!rows?.length) throw new Error("Lançamento não encontrado ou já cancelado");
    return { ok: true };
  });

export const settleTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("transactions")
      .update({ status: "posted" })
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .eq("status", "pending")
      .select("id");
    check(error);
    if (!rows?.length) throw new Error("Lançamento não está pendente");
    return { ok: true };
  });
