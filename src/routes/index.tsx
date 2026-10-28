import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rhema Capital — Gestão patrimonial" },
      { name: "description", content: "Sistema pessoal de gestão financeira e patrimonial Rhema Capital." },
      { property: "og:title", content: "Rhema Capital — Gestão patrimonial" },
      { property: "og:description", content: "Sistema pessoal de gestão financeira e patrimonial Rhema Capital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-sidebar px-6 text-center text-sidebar-foreground">
      <div className="gold-rule mb-6" aria-hidden />
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Rhema Capital</p>
      <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight sm:text-6xl">
        Gestão financeira e patrimonial
      </h1>
      <p className="mt-4 max-w-md text-sm opacity-80">Ambiente privado de uso exclusivo do proprietário.</p>
      <Button asChild size="lg" className="mt-10 bg-gold text-gold-foreground hover:bg-gold/90">
        <Link to="/auth">Acessar</Link>
      </Button>
    </main>
  );
}
