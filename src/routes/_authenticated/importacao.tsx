import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ImportPage } from "@/features/imports/import-page";

export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({
    meta: [
      { title: "Importação CSV — Rhema Capital" },
      { name: "description", content: "Revisão de extratos CSV, categorias e conciliação de previstos." },
      { property: "og:title", content: "Importação CSV — Rhema Capital" },
      { property: "og:description", content: "Importação e conciliação financeira pessoal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  notFoundComponent: () => <EmptyState title="Página não encontrada" />,
  component: ImportPage,
});
