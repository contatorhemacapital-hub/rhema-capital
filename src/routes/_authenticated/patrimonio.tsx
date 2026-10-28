import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/patrimonio")({
  head: () => ({ meta: [{ title: "Patrimônio — Rhema Capital" }] }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Patrimônio" description="Imóveis, veículos, investimentos e participações." />
      <EmptyState title="Módulo em preparação" description="Este módulo será disponibilizado em uma próxima etapa." />
    </>
  );
}
