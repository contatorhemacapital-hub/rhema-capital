import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Field, LoadingState, NativeSelect, PageHeader } from "@/components/states";
import { useClient } from "@/features/clients/client-context";
import { clientsQuery } from "@/features/clients/queries";
import { formatCpf, isValidCpf, maskCpf, onlyDigits } from "@/features/clients/cpf";
import { saveClient } from "@/features/clients/clients.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Rhema Capital" }] }),
  pendingComponent: LoadingState,
  errorComponent: ({ error }) => <ErrorState error={error} />,
  component: ClientsPage,
});

function ClientsPage() {
  const { isAdmin } = useClient();
  if (!isAdmin) return <EmptyState title="Acesso restrito" />;
  return <AdminClientsPage />;
}

function AdminClientsPage() {
  const { data: clients } = useSuspenseQuery(clientsQuery());
  const { setClientId } = useClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Tables<"clients"> | "new" | null>(null);
  const normalizedSearch = onlyDigits(search);
  const filtered = clients.filter((client) =>
    `${client.name} ${client.email ?? ""} ${client.cpf ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) ||
    Boolean(normalizedSearch && (client.cpf ?? "").includes(normalizedSearch)),
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastre clientes e selecione com qual deles trabalhar."
        actions={<Button onClick={() => setEditing("new")}><Plus aria-hidden /> Novo cliente</Button>}
      />
      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Buscar cliente</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input className="pl-9" placeholder="Buscar por nome, e-mail ou CPF" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {filtered.length === 0 ? (
        <EmptyState title={clients.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"} />
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <caption className="sr-only">Clientes cadastrados</caption>
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3">{client.email ?? ""}</td>
                  <td className="px-4 py-3 tabular">{client.cpf ? maskCpf(client.cpf) : ""}</td>
                  <td className="px-4 py-3">{client.phone ?? ""}</td>
                  <td className="px-4 py-3">{client.status === "active" ? "Ativo" : "Inativo"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setClientId(client.id); toast.success(`Agora trabalhando com ${client.name}`); }}>
                        Trabalhar com este cliente
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Editar ${client.name}`} onClick={() => setEditing(client)}>
                        <Pencil aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ClientDialog key={editing === "new" ? "new" : editing.id} client={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ClientDialog({ client, onClose }: { client?: Tables<"clients">; onClose: () => void }) {
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [cpf, setCpf] = useState(client?.cpf ? formatCpf(client.cpf) : "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [status, setStatus] = useState<"active" | "inactive">((client?.status as "active" | "inactive" | undefined) ?? "active");
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveClient);
  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ]);
      toast.success(client ? "Cliente atualizado" : "Cliente criado");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = onlyDigits(cpf);
    if (digits && !isValidCpf(digits)) {
      toast.error("CPF inválido");
      return;
    }
    save.mutate({
      data: {
        ...(client ? { id: client.id } : {}),
        name,
        ...(email ? { email } : {}),
        ...(digits ? { cpf: digits } : {}),
        ...(phone ? { phone } : {}),
        ...(notes ? { notes } : {}),
        status,
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>Os dados do cliente ajudam a identificar e organizar os registros.</DialogDescription>
          </DialogHeader>
          <Field label="Nome" htmlFor="client-name">
            <Input id="client-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
          </Field>
          <Field label="E-mail" htmlFor="client-email">
            <Input id="client-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="CPF" htmlFor="client-cpf">
            <Input id="client-cpf" inputMode="numeric" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} />
          </Field>
          <Field label="Telefone" htmlFor="client-phone">
            <Input id="client-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Observações" htmlFor="client-notes">
            <Textarea id="client-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <Field label="Status" htmlFor="client-status">
            <NativeSelect id="client-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
