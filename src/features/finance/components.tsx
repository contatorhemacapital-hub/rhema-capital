import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/states";
import { cn } from "@/lib/utils";
import {
  cancelTransaction,
  saveAccount,
  saveCategory,
  saveTransaction,
  type Account,
  type Category,
  type Transaction,
} from "./finance.functions";
import { ACCOUNT_TYPES, KIND_LABEL, STATUS_LABEL, accountInput, categoryInput, transactionInput } from "./schemas";
import { formatMoney, parseMoneyInput } from "./money";

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useFinanceMutation<T>(fn: (v: T) => Promise<unknown>, success: string, onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(success);
      onDone?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });
}

type Errors = Record<string, string | undefined>;
function zodErrors(issues: { path: (string | number)[]; message: string }[]): Errors {
  const out: Errors = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  pending,
  submitLabel = "Salvar",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  pending: boolean;
  submitLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const toInput = (n: number) => n.toFixed(2).replace(".", ",");

export function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: Account }) {
  const [name, setName] = useState(account?.name ?? "");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [type, setType] = useState(account?.type ?? "checking");
  const [opening, setOpening] = useState(account ? toInput(account.opening_balance) : "0,00");
  const [openingDate, setOpeningDate] = useState(account?.opening_date ?? today());
  const [errors, setErrors] = useState<Errors>({});
  const m = useFinanceMutation((d: unknown) => saveAccount({ data: d as never }), account ? "Conta atualizada" : "Conta criada", () =>
    onOpenChange(false),
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = accountInput.safeParse({
      id: account?.account_id,
      name,
      institution,
      type,
      openingBalance: parseMoneyInput(opening) ?? "x",
      openingDate,
    });
    if (!parsed.success) return setErrors(zodErrors(parsed.error.issues));
    setErrors({});
    m.mutate(parsed.data);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? "Editar conta" : "Nova conta"}
      description="O saldo inicial é registrado na data-base e fica separado das movimentações."
      onSubmit={submit}
      pending={m.isPending}
    >
      <Field label="Nome" htmlFor="acc-name" error={errors.name}>
        <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instituição" htmlFor="acc-inst" error={errors.institution}>
          <Input id="acc-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Tipo" htmlFor="acc-type" error={errors.type}>
          <NativeSelect id="acc-type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Saldo inicial (R$)" htmlFor="acc-open" error={errors.openingBalance && "Valor inválido"}>
          <Input id="acc-open" inputMode="decimal" className="tabular" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </Field>
        <Field label="Data-base" htmlFor="acc-date" error={errors.openingDate}>
          <Input id="acc-date" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
  defaultKind = "expense",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category?: Category;
  categories: Category[];
  defaultKind?: "income" | "expense";
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<"income" | "expense">(category?.kind ?? defaultKind);
  const [parentId, setParentId] = useState(category?.parent_id ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const parents = categories.filter((c) => !c.parent_id && c.kind === kind && c.id !== category?.id && !c.archived_at);
  const m = useFinanceMutation((d: unknown) => saveCategory({ data: d as never }), "Categoria salva", () => onOpenChange(false));

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = categoryInput.safeParse({ id: category?.id, name, kind, parentId: parentId || null });
    if (!parsed.success) return setErrors(zodErrors(parsed.error.issues));
    setErrors({});
    m.mutate(parsed.data);
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={category ? "Editar categoria" : "Nova categoria"} onSubmit={submit} pending={m.isPending}>
      <Field label="Nome" htmlFor="cat-name" error={errors.name}>
        <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="cat-kind">
          <NativeSelect
            id="cat-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "income" | "expense");
              setParentId("");
            }}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </NativeSelect>
        </Field>
        <Field label="Subcategoria de" htmlFor="cat-parent">
          <NativeSelect id="cat-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Categoria principal —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </FormDialog>
  );
}

export function CategoryOptions({ categories, kind }: { categories: Category[]; kind: "income" | "expense" }) {
  const roots = categories.filter((c) => c.kind === kind && !c.parent_id);
  return (
    <>
      {roots.map((r) => (
        <optgroup key={r.id} label={r.name + (r.archived_at ? " (arquivada)" : "")}>
          <option value={r.id}>{r.name}</option>
          {categories
            .filter((c) => c.parent_id === r.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {r.name} › {c.name}
                {c.archived_at ? " (arquivada)" : ""}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

export function TransactionDialog({
  open,
  onOpenChange,
  tx,
  accounts,
  categories,
  initialKind = "expense",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tx?: Transaction;
  accounts: Account[];
  categories: Category[];
  initialKind?: Transaction["kind"];
}) {
  const active = accounts.filter((a) => !a.archived_at || a.account_id === tx?.account_id || a.account_id === tx?.destination_account_id);
  const [kind, setKind] = useState<Transaction["kind"]>(tx?.kind ?? initialKind);
  const [status, setStatus] = useState<"pending" | "posted">(tx?.status === "pending" ? "pending" : "posted");
  const [accountId, setAccountId] = useState(tx?.account_id ?? active[0]?.account_id ?? "");
  const [destId, setDestId] = useState(tx?.destination_account_id ?? "");
  const [categoryId, setCategoryId] = useState(tx?.category_id ?? "");
  const [amount, setAmount] = useState(tx ? toInput(tx.amount) : "");
  const [date, setDate] = useState(tx?.date ?? today());
  const [description, setDescription] = useState(tx?.description ?? "");
  const [notes, setNotes] = useState(tx?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const usable = useMemo(
    () => categories.filter((c) => !c.archived_at || c.id === tx?.category_id),
    [categories, tx?.category_id],
  );
  const m = useFinanceMutation((d: unknown) => saveTransaction({ data: d as never }), tx ? "Lançamento atualizado" : "Lançamento registrado", () =>
    onOpenChange(false),
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = transactionInput.safeParse({
      id: tx?.id,
      kind,
      status,
      accountId,
      destinationAccountId: kind === "transfer" ? destId || null : null,
      categoryId: kind === "transfer" ? null : categoryId || null,
      amount: parseMoneyInput(amount) ?? "x",
      date,
      description,
      notes: notes || null,
    });
    if (!parsed.success) return setErrors(zodErrors(parsed.error.issues));
    setErrors({});
    m.mutate(parsed.data);
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={tx ? "Editar lançamento" : "Novo lançamento"} onSubmit={submit} pending={m.isPending}>
      {!tx && (
        <div role="radiogroup" aria-label="Tipo de lançamento" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {(["expense", "income", "transfer"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setCategoryId("");
              }}
              className={cn(
                "rounded px-2 py-1.5 text-sm font-medium transition-colors",
                kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      <Field label="Descrição" htmlFor="tx-desc" error={errors.description}>
        <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)" htmlFor="tx-amount" error={errors.amount && "Informe um valor maior que zero"}>
          <Input id="tx-amount" inputMode="decimal" placeholder="0,00" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field
          label={status === "pending" ? "Data prevista" : kind === "income" ? "Data de recebimento" : kind === "expense" ? "Data de pagamento" : "Data"}
          htmlFor="tx-date"
          error={errors.date}
        >
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={kind === "transfer" ? "Conta de origem" : "Conta"} htmlFor="tx-acc" error={errors.accountId && "Escolha a conta"}>
          <NativeSelect id="tx-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Selecione…</option>
            {active.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.name}
                {a.archived_at ? " (arquivada)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {kind === "transfer" ? (
          <Field label="Conta de destino" htmlFor="tx-dest" error={errors.destinationAccountId}>
            <NativeSelect id="tx-dest" value={destId} onChange={(e) => setDestId(e.target.value)}>
              <option value="">Selecione…</option>
              {active
                .filter((a) => a.account_id !== accountId)
                .map((a) => (
                  <option key={a.account_id} value={a.account_id}>
                    {a.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field label="Categoria" htmlFor="tx-cat" error={errors.categoryId}>
            <NativeSelect id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Selecione…</option>
              <CategoryOptions categories={usable} kind={kind} />
            </NativeSelect>
          </Field>
        )}
        <Field label="Situação" htmlFor="tx-status">
          <NativeSelect id="tx-status" value={status} onChange={(e) => setStatus(e.target.value as "pending" | "posted")}>
            <option value="posted">{STATUS_LABEL.posted}</option>
            <option value="pending">{STATUS_LABEL.pending}</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Observações" htmlFor="tx-notes" error={errors.notes}>
        <Textarea id="tx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </Field>
      {kind !== "transfer" && usable.filter((c) => c.kind === kind).length === 0 && (
        <p className="text-xs text-muted-foreground">Cadastre categorias em Configurações para registrar {KIND_LABEL[kind].toLowerCase()}s.</p>
      )}
    </FormDialog>
  );
}

export function CancelDialog({ tx, onOpenChange }: { tx: Transaction | null; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState("");
  const m = useFinanceMutation((d: { id: string; reason: string }) => cancelTransaction({ data: d }), "Lançamento cancelado", () => {
    setReason("");
    onOpenChange(false);
  });
  return (
    <FormDialog
      open={!!tx}
      onOpenChange={onOpenChange}
      title="Cancelar lançamento"
      description="O lançamento permanece no histórico como cancelado e deixa de afetar os saldos. Esta ação não pode ser desfeita."
      submitLabel="Confirmar cancelamento"
      pending={m.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return toast.error("Informe o motivo");
        if (tx) m.mutate({ id: tx.id, reason });
      }}
    >
      {tx && (
        <p className="text-sm">
          {tx.description} · <span className="tabular">{formatMoney(tx.amount)}</span>
        </p>
      )}
      <Field label="Motivo" htmlFor="cancel-reason">
        <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </Field>
    </FormDialog>
  );
}
