import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/states";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Rhema Capital" },
      { name: "description", content: "Acesso privado ao sistema Rhema Capital." },
      { property: "og:title", content: "Entrar — Rhema Capital" },
      { property: "og:description", content: "Acesso privado ao sistema Rhema Capital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        setInfo("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Entrar" : mode === "signup" ? "Primeiro acesso" : "Recuperar senha";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Rhema Capital</p>
        <div>
          <div className="gold-rule mb-6" aria-hidden />
          <p className="font-display text-4xl leading-tight">Clareza sobre o seu patrimônio.</p>
        </div>
        <p className="text-xs opacity-60">Acesso exclusivo do proprietário.</p>
      </aside>
      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="card-surface w-full max-w-sm space-y-5 p-8" noValidate>
          <div>
            <div className="gold-rule mb-3" aria-hidden />
            <h1 className="text-3xl font-semibold">{title}</h1>
            {mode === "signup" && (
              <p className="mt-1 text-xs text-muted-foreground">
                A primeira conta confirmada se torna a proprietária. Outras contas não terão acesso aos dados.
              </p>
            )}
          </div>
          <Field label="E-mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode !== "forgot" && (
            <Field label="Senha" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          {info && <p className="rounded-md bg-accent p-3 text-sm" role="status">{info}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Aguarde…" : title}
          </Button>
          <div className="flex flex-col gap-1 text-center text-sm">
            {mode !== "signin" && (
              <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode("signin")}>
                Voltar para entrar
              </button>
            )}
            {mode === "signin" && (
              <>
                <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>
                  Esqueci a senha
                </button>
                <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  Primeiro acesso
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
