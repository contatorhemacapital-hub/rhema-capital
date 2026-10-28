import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/consorcios")({
  head: () => ({ meta: [{ title: "Consórcios — Rhema Capital" }] }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Consórcios" description="Cartas, grupos, cotas e parcelas." />
      <EmptyState title="Módulo em preparação" description="Este módulo será disponibilizado em uma próxima etapa." />
    </>
  );
}
