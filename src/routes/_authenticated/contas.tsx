import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from "@/components/states";
import { accountsQuery } from "@/features/finance/queries";
import { AccountDialog, useFinanceMutation } from "@/features/finance/components";
import { setAccountArchived, type Account } from "@/features/finance/finance.functions";
import { ACCOUNT_TYPES } from "@/features/finance/schemas";
import { formatDate, formatMoney, fromCents, toCents } from "@/features/finance/money";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({ meta: [{ title: "Contas — Rhema Capital" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery()),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  component: ContasPage,
});

function ContasPage() {
  const { data: accounts } = useSuspenseQuery(accountsQuery());
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const active = accounts.filter((a) => !a.archived_at);
  const archived = accounts.filter((a) => a.archived_at);
  const total = active.reduce((s, a) => s + toCents(a.balance), 0);
  const pending = active.reduce((s, a) => s + toCents(a.pending_net), 0);

  return (
    <>
      <PageHeader
        title="Contas"
        description="Contas financeiras, saldo inicial e saldo atual efetivado."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Nova conta
          </Button>
        }
      />
      {accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta cadastrada"
          description="Cadastre sua primeira conta com o saldo inicial na data-base."
          action={<Button onClick={() => setEditing("new")}>Cadastrar conta</Button>}
        />
      ) : (
        <div className="space-y-10">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Saldo consolidado" value={formatMoney(fromCents(total))} hint={`${active.length} conta(s) ativa(s) · apenas efetivados`} />
            <StatCard label="Pendências líquidas" value={formatMoney(fromCents(pending))} hint="Previsto, ainda não efetivado" />
          </div>
          <AccountList accounts={active} onEdit={setEditing} />
          {archived.length > 0 && (
            <section aria-labelledby="archived-h">
              <h2 id="archived-h" className="mb-3 text-xl font-semibold text-muted-foreground">
                Contas arquivadas
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">Fora do saldo consolidado. Histórico preservado.</p>
              <AccountList accounts={archived} onEdit={setEditing} />
            </section>
          )}
        </div>
      )}
      {editing && (
        <AccountDialog
          key={editing === "new" ? "new" : editing.account_id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          account={editing === "new" ? undefined : editing}
        />
      )}
    </>
  );
}

function AccountList({ accounts, onEdit }: { accounts: Account[]; onEdit: (a: Account) => void }) {
  const archive = useFinanceMutation((d: { id: string; archived: boolean }) => setAccountArchived({ data: d }), "Conta atualizada");
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {accounts.map((a) => (
        <li key={a.account_id} className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-xl font-semibold">{a.name}</h3>
                {a.archived_at && <Badge variant="secondary">Arquivada</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {ACCOUNT_TYPES[a.type as keyof typeof ACCOUNT_TYPES] ?? a.type}
                {a.institution ? ` · ${a.institution}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" aria-label={`Editar ${a.name}`} onClick={() => onEdit(a)}>
                <Pencil aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={a.archived_at ? `Reativar ${a.name}` : `Arquivar ${a.name}`}
                disabled={archive.isPending}
                onClick={() => archive.mutate({ id: a.account_id, archived: !a.archived_at })}
              >
                {a.archived_at ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              </Button>
            </div>
          </div>
          <p className="tabular mt-4 font-display text-3xl font-semibold">{formatMoney(a.balance)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <dt>Saldo inicial ({formatDate(a.opening_date)})</dt>
            <dd className="tabular text-right">{formatMoney(a.opening_balance)}</dd>
            <dt>Receitas</dt>
            <dd className="tabular text-right text-income">{formatMoney(a.income_posted)}</dd>
            <dt>Despesas</dt>
            <dd className="tabular text-right text-expense">−{formatMoney(a.expense_posted)}</dd>
            <dt>Transferências (entrada − saída)</dt>
            <dd className="tabular text-right">{formatMoney(fromCents(toCents(a.transfer_in) - toCents(a.transfer_out)))}</dd>
            {toCents(a.pending_net) !== 0 && (
              <>
                <dt className="text-pending">Pendente</dt>
                <dd className="tabular text-right text-pending">{formatMoney(a.pending_net)}</dd>
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
