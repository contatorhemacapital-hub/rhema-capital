import type { ReactNode, SelectHTMLAttributes } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="gold-rule mb-3" aria-hidden />
        <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card-surface flex flex-col items-center px-6 py-14 text-center">
      <Inbox className="mb-3 size-8 text-gold" aria-hidden />
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const router = useRouter();
  const qr = useQueryErrorResetBoundary();
  const msg = error instanceof Error ? error.message : "Erro inesperado";
  return (
    <div role="alert" className="card-surface flex flex-col items-center px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-8 text-destructive" aria-hidden />
      <h2 className="text-xl font-semibold">Não foi possível carregar</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{msg}</p>
      <Button
        className="mt-5"
        variant="outline"
        onClick={() => {
          qr.reset();
          router.invalidate();
        }}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

export function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "income" | "expense" }) {
  return (
    <div className="card-surface p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular mt-2 font-display text-3xl font-semibold",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
    />
  );
}
