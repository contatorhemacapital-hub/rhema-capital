import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { accountsQuery, categoriesQuery } from "@/features/finance/queries";
import { PlanningPage } from "@/features/planning/planning-page";
import { planningQuery } from "@/features/planning/queries";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({ meta: [{ title: "Planejamento — Rhema Capital" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(planningQuery()),
      context.queryClient.ensureQueryData(accountsQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  notFoundComponent: () => <EmptyState title="Página não encontrada" />,
  component: PlanningPage,
});
