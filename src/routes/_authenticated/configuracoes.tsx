import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/states";
import { categoriesQuery } from "@/features/finance/queries";
import { CategoryDialog, useFinanceMutation } from "@/features/finance/components";
import { setCategoryArchived, type Category } from "@/features/finance/finance.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Rhema Capital" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery()),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  component: ConfigPage,
});

function ConfigPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const [editing, setEditing] = useState<{ cat?: Category; kind: "income" | "expense" } | null>(null);

  return (
    <>
      <PageHeader title="Configurações" description="Categorias e subcategorias de receitas e despesas." />
      <div className="grid gap-6 lg:grid-cols-2">
        {(["expense", "income"] as const).map((kind) => (
          <CategoryColumn key={kind} kind={kind} categories={categories} onEdit={(cat) => setEditing({ cat, kind })} onNew={() => setEditing({ kind })} />
        ))}
      </div>
      {editing && (
        <CategoryDialog
          key={editing.cat?.id ?? `new-${editing.kind}`}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          category={editing.cat}
          categories={categories}
          defaultKind={editing.kind}
        />
      )}
    </>
  );
}

function CategoryColumn({
  kind,
  categories,
  onEdit,
  onNew,
}: {
  kind: "income" | "expense";
  categories: Category[];
  onEdit: (c: Category) => void;
  onNew: () => void;
}) {
  const archive = useFinanceMutation((d: { id: string; archived: boolean }) => setCategoryArchived({ data: d }), "Categoria atualizada");
  const roots = categories.filter((c) => c.kind === kind && !c.parent_id);
  const title = kind === "income" ? "Receitas" : "Despesas";

  const Row = ({ c, sub }: { c: Category; sub?: boolean }) => (
    <li className={`flex items-center justify-between gap-2 py-2 ${sub ? "pl-6" : ""}`}>
      <span className={`flex items-center gap-2 text-sm ${c.archived_at ? "text-muted-foreground" : ""} ${sub ? "" : "font-medium"}`}>
        {sub && <span aria-hidden className="text-gold">›</span>}
        {c.name}
        {c.archived_at && <Badge variant="secondary">Arquivada</Badge>}
      </span>
      <span className="flex gap-1">
        <Button size="icon" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => onEdit(c)}>
          <Pencil aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={c.archived_at ? `Reativar ${c.name}` : `Arquivar ${c.name}`}
          onClick={() => archive.mutate({ id: c.id, archived: !c.archived_at })}
        >
          {c.archived_at ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        </Button>
      </span>
    </li>
  );

  return (
    <section className="card-surface p-5" aria-labelledby={`h-${kind}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id={`h-${kind}`} className="text-2xl font-semibold">{title}</h2>
        <Button size="sm" variant="outline" onClick={onNew}>
          <Plus aria-hidden /> Nova
        </Button>
      </div>
      {roots.length === 0 ? (
        <EmptyState title="Nenhuma categoria" description={`Crie categorias de ${title.toLowerCase()} para organizar seus lançamentos.`} />
      ) : (
        <ul className="divide-y">
          {roots.map((r) => (
            <li key={r.id}>
              <ul>
                <Row c={r} />
                {categories
                  .filter((c) => c.parent_id === r.id)
                  .map((c) => (
                    <Row key={c.id} c={c} sub />
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
