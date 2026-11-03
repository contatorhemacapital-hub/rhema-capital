import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  cpf: z.string().regex(/^\d*$/).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(["active", "inactive"]),
});

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [admin, clients] = await Promise.all([
      context.supabase.rpc("is_admin"),
      context.supabase.from("clients").select("*").order("name"),
    ]);
    if (admin.error) throw new Error(admin.error.message);
    if (clients.error) throw new Error(clients.error.message);
    return {
      userId: context.userId,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
      isAdmin: admin.data === true,
      clients: clients.data ?? [],
    };
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("clients").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => clientSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { id, ...values } = data;
    const row = {
      name: values.name,
      email: values.email || null,
      cpf: values.cpf || null,
      phone: values.phone || null,
      notes: values.notes || null,
      status: values.status,
    };
    const result = id
      ? await context.supabase.from("clients").update(row).eq("id", id).select("*").single()
      : await context.supabase.from("clients").insert({ ...row, created_by: context.userId }).select("*").single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
