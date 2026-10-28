import { z } from "zod";

export const ACCOUNT_TYPES = {
  checking: "Conta corrente",
  savings: "Poupança",
  investment: "Investimentos",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
  other: "Outra",
} as const;

export const KIND_LABEL = { income: "Receita", expense: "Despesa", transfer: "Transferência" } as const;
export const STATUS_LABEL = { pending: "Pendente", posted: "Efetivada", cancelled: "Cancelada" } as const;

const uuid = z.string().uuid();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Data inválida");
const money = z.string().regex(/^-?\d{1,16}(\.\d{1,2})?$/, "Valor inválido");
const positiveMoney = money.refine((s) => Number(s) > 0, "O valor deve ser maior que zero");

export const accountInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Informe o nome").max(80),
  institution: z.string().trim().max(80).optional().nullable(),
  type: z.enum(Object.keys(ACCOUNT_TYPES) as [keyof typeof ACCOUNT_TYPES, ...(keyof typeof ACCOUNT_TYPES)[]]),
  openingBalance: money,
  openingDate: isoDate,
});
export type AccountInput = z.infer<typeof accountInput>;

export const categoryInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Informe o nome").max(60),
  kind: z.enum(["income", "expense"]),
  parentId: uuid.optional().nullable(),
});
export type CategoryInput = z.infer<typeof categoryInput>;

export const transactionInput = z
  .object({
    id: uuid.optional(),
    kind: z.enum(["income", "expense", "transfer"]),
    status: z.enum(["pending", "posted"]),
    accountId: uuid,
    destinationAccountId: uuid.optional().nullable(),
    categoryId: uuid.optional().nullable(),
    amount: positiveMoney,
    date: isoDate,
    description: z.string().trim().min(1, "Informe a descrição").max(200),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.destinationAccountId)
        ctx.addIssue({ code: "custom", path: ["destinationAccountId"], message: "Escolha a conta de destino" });
      else if (v.destinationAccountId === v.accountId)
        ctx.addIssue({ code: "custom", path: ["destinationAccountId"], message: "Origem e destino devem ser diferentes" });
      if (v.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Transferências não têm categoria" });
    } else {
      if (!v.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Escolha uma categoria" });
      if (v.destinationAccountId)
        ctx.addIssue({ code: "custom", path: ["destinationAccountId"], message: "Apenas transferências têm destino" });
    }
  });
export type TransactionInput = z.infer<typeof transactionInput>;

export const txFilters = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  accountId: uuid.optional(),
  categoryId: uuid.optional(),
  kind: z.enum(["income", "expense", "transfer"]).optional(),
  status: z.enum(["pending", "posted", "cancelled"]).optional(),
  q: z.string().trim().max(100).optional(),
});
export type TxFilters = z.infer<typeof txFilters>;

export const idInput = z.object({ id: uuid });
export const cancelInput = z.object({ id: uuid, reason: z.string().trim().min(1, "Informe o motivo").max(200) });
export const archiveInput = z.object({ id: uuid, archived: z.boolean() });
