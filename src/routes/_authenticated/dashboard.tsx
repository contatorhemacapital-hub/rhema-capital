import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from "@/components/states";
import { accountsQuery, transactionsQuery } from "@/features/finance/queries";
import { formatDate, formatMoney, fromCents, summarize, toCents } from "@/features/finance/money";

function month() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(new Date(y, d.getMonth() + 1, 0).getDate()).padStart(2, "0")}` };
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Rhema Capital" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(accountsQuery()),
      context.queryClient.ensureQueryData(transactionsQuery(month())),
    ]),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  component: Dashboard,
});

function Dashboard() {
  const { data: accounts } = useSuspenseQuery(accountsQuery());
  const { data: txs } = useSuspenseQuery(transactionsQuery(month()));
  const active = accounts.filter((a) => !a.archived_at);
  const total = active.reduce((s, a) => s + toCents(a.balance), 0);
  const sum = summarize(txs);
  const label = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Dashboard" description={`Visão consolidada · ${label}`} />
      {accounts.length === 0 ? (
        <EmptyState
          title="Comece cadastrando uma conta"
          description="Os indicadores aparecerão assim que houver contas e movimentações."
          action={
            <Button asChild>
              <Link to="/contas">Ir para Contas</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saldo consolidado" value={formatMoney(fromCents(total))} hint="Contas ativas, efetivados" />
            <StatCard label="Receitas do mês" value={formatMoney(fromCents(sum.income))} tone="income" />
            <StatCard label="Despesas do mês" value={formatMoney(fromCents(sum.expense))} tone="expense" />
            <StatCard label="Pendentes do mês" value={String(sum.pending)} hint="Lançamentos a efetivar" />
          </div>
          <section className="card-surface p-5">
            <h2 className="mb-4 text-xl font-semibold">Últimos lançamentos do mês</h2>
            {txs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
            ) : (
              <ul className="divide-y">
                {txs.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="tabular mr-3 text-muted-foreground">{formatDate(t.date)}</span>
                      {t.description}
                    </span>
                    <span className="tabular shrink-0">
                      {t.kind === "expense" ? "−" : ""}
                      {formatMoney(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-2 px-0">
              <Link to="/movimentacoes">Ver todas as movimentações</Link>
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
