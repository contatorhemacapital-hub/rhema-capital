import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState, NativeSelect, PageHeader, StatCard } from "@/components/states";
import { accountsQuery, categoriesQuery, transactionsQuery } from "@/features/finance/queries";
import { CancelDialog, CategoryOptions, TransactionDialog, useFinanceMutation } from "@/features/finance/components";
import { settleTransaction, type Transaction } from "@/features/finance/finance.functions";
import { KIND_LABEL, STATUS_LABEL, txFilters, type TxFilters } from "@/features/finance/schemas";
import { formatDate, formatMoney, fromCents, summarize } from "@/features/finance/money";
import { cn } from "@/lib/utils";

function monthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações — Rhema Capital" }] }),
  validateSearch: (s: Record<string, unknown>): TxFilters => {
    const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "string" && v !== ""));
    const r = txFilters.safeParse(clean);
    const base = r.success ? r.data : {};
    return Object.keys(clean).length === 0 ? monthRange() : base;
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(accountsQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
      context.queryClient.ensureQueryData(transactionsQuery(deps)),
    ]),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  component: MovPage,
});

function MovPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/movimentacoes" });
  const { data: accounts } = useSuspenseQuery(accountsQuery());
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const { data: txs } = useSuspenseQuery(transactionsQuery(filters));
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  const [cancelling, setCancelling] = useState<Transaction | null>(null);
  const [q, setQ] = useState(filters.q ?? "");
  const settle = useFinanceMutation((id: string) => settleTransaction({ data: { id } }), "Lançamento efetivado");

  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q) set({ q: q || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function set(patch: Partial<TxFilters>) {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  }

  const accName = new Map(accounts.map((a) => [a.account_id, a.name + (a.archived_at ? " (arquivada)" : "")]));
  const catName = new Map(
    categories.map((c) => {
      const parent = categories.find((p) => p.id === c.parent_id);
      return [c.id, parent ? `${parent.name} › ${c.name}` : c.name];
    }),
  );
  const sum = summarize(txs);
  const selectedKind = filters.kind && filters.kind !== "transfer" ? filters.kind : null;

  return (
    <>
      <PageHeader
        title="Movimentações"
        description="Receitas e despesas pelo regime de caixa. Transferências não entram nos totais."
        actions={
          <Button onClick={() => setEditing("new")} disabled={accounts.filter((a) => !a.archived_at).length === 0}>
            <Plus aria-hidden /> Novo lançamento
          </Button>
        }
      />

      <section aria-label="Filtros" className="card-surface mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="relative lg:col-span-2">
          <span className="sr-only">Pesquisar descrição</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Pesquisar descrição" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        </label>
        <label>
          <span className="sr-only">De</span>
          <Input type="date" aria-label="Data inicial" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
        </label>
        <label>
          <span className="sr-only">Até</span>
          <Input type="date" aria-label="Data final" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
        </label>
        <NativeSelect aria-label="Conta" value={filters.accountId ?? ""} onChange={(e) => set({ accountId: e.target.value || undefined })}>
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>
              {accName.get(a.account_id)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Tipo"
          value={filters.kind ?? ""}
          onChange={(e) => set({ kind: (e.target.value || undefined) as TxFilters["kind"], categoryId: undefined })}
        >
          <option value="">Todos os tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
          <option value="transfer">Transferências</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Categoria"
          className="lg:col-span-2"
          value={filters.categoryId ?? ""}
          disabled={filters.kind === "transfer"}
          onChange={(e) => set({ categoryId: e.target.value || undefined })}
        >
          <option value="">Todas as categorias</option>
          {(!selectedKind || selectedKind === "income") && <CategoryOptions categories={categories} kind="income" />}
          {(!selectedKind || selectedKind === "expense") && <CategoryOptions categories={categories} kind="expense" />}
        </NativeSelect>
        <NativeSelect
          aria-label="Situação"
          value={filters.status ?? ""}
          onChange={(e) => set({ status: (e.target.value || undefined) as TxFilters["status"] })}
        >
          <option value="">Todas as situações</option>
          <option value="posted">Efetivadas</option>
          <option value="pending">Pendentes</option>
          <option value="cancelled">Canceladas</option>
        </NativeSelect>
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            navigate({ search: monthRange() });
          }}
        >
          Mês atual
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            navigate({ search: { from: "1900-01-01" } });
          }}
        >
          Todo o período
        </Button>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Receitas efetivadas" value={formatMoney(fromCents(sum.income))} tone="income" />
        <StatCard label="Despesas efetivadas" value={formatMoney(fromCents(sum.expense))} tone="expense" />
        <StatCard label="Resultado do período" value={formatMoney(fromCents(sum.net))} hint={`${sum.pending} pendente(s)`} />
      </div>

      {accounts.length === 0 ? (
        <EmptyState title="Cadastre uma conta primeiro" description="Os lançamentos são sempre vinculados a uma conta." />
      ) : txs.length === 0 ? (
        <EmptyState title="Nenhuma movimentação encontrada" description="Ajuste os filtros ou registre um novo lançamento." />
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Lista de movimentações</caption>
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className={cn("border-b last:border-0", t.status === "cancelled" && "text-muted-foreground line-through decoration-1")}>
                  <td className="tabular whitespace-nowrap px-4 py-3">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{t.description}</span>
                    {t.cancel_reason && <span className="block text-xs no-underline">Cancelado: {t.cancel_reason}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {t.kind === "transfer"
                      ? `${accName.get(t.account_id)} → ${accName.get(t.destination_account_id!)}`
                      : accName.get(t.account_id)}
                  </td>
                  <td className="px-4 py-3">{t.kind === "transfer" ? KIND_LABEL.transfer : catName.get(t.category_id!)}</td>
                  <td
                    className={cn(
                      "tabular whitespace-nowrap px-4 py-3 text-right font-medium",
                      t.status !== "cancelled" && t.kind === "income" && "text-income",
                      t.status !== "cancelled" && t.kind === "expense" && "text-expense",
                    )}
                  >
                    {t.kind === "expense" ? "−" : ""}
                    {formatMoney(t.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === "posted" ? "secondary" : "outline"} className={cn(t.status === "pending" && "border-pending text-pending")}>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    {t.status !== "cancelled" && (
                      <div className="flex justify-end gap-1">
                        {t.status === "pending" && (
                          <Button size="icon" variant="ghost" aria-label="Marcar como efetivada" disabled={settle.isPending} onClick={() => settle.mutate(t.id)}>
                            <CheckCircle2 aria-hidden />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(t)}>
                          <Pencil aria-hidden />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Cancelar lançamento" onClick={() => setCancelling(t)}>
                          <Ban aria-hidden />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {txs.length >= 1000 && <p className="p-3 text-xs text-muted-foreground">Exibindo os 1.000 lançamentos mais recentes. Refine os filtros.</p>}
        </div>
      )}

      {editing && (
        <TransactionDialog
          key={editing === "new" ? "new" : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          tx={editing === "new" ? undefined : editing}
          accounts={accounts}
          categories={categories}
        />
      )}
      <CancelDialog tx={cancelling} onOpenChange={(o) => !o && setCancelling(null)} />
    </>
  );
}
