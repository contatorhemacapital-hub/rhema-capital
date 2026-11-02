import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PlanningPage } from "@/features/planning/planning-page";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({ meta: [{ title: "Planejamento — Rhema Capital" }] }),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  notFoundComponent: () => <EmptyState title="Página não encontrada" />,
  component: PlanningPage,
});
