import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({ meta: [{ title: "Planejamento — Rhema Capital" }] }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Planejamento" description="Metas e projeções patrimoniais." />
      <EmptyState title="Módulo em preparação" description="Este módulo será disponibilizado em uma próxima etapa." />
    </>
  );
}
