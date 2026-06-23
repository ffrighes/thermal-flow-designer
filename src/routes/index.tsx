import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Snowflake, Calculator, GitBranch, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FrioFlow — Balanço Térmico de Refrigeração Industrial" },
      {
        name: "description",
        content:
          "Monte diagramas de sistemas de refrigeração industrial e calcule o balanço térmico com fórmulas e unidades corretas.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Snowflake className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-tight">FrioFlow</span>
          </div>
          <Link to="/auth">
            <Button size="sm">Entrar</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
            Refrigeração industrial · NH₃
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight">
            Diagrame seu sistema. <br />
            <span className="text-primary">Veja o balanço térmico</span> com as fórmulas.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Arraste compressores, condensadores, evaporadores, separadores, chillers, trocadores
            e tanques para o canvas. Conecte com tubulações em aço, informe os parâmetros e o
            FrioFlow calcula a capacidade frigorífica, o calor rejeitado e a potência de
            compressão — sempre mostrando a fórmula simbólica, a substituição e o resultado.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button size="lg">Começar agora</Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          <Feature
            icon={GitBranch}
            title="Editor visual"
            text="9 tipos de equipamento + tubulação em aço carbono ou inox, com paleta arrastável e canvas pan/zoom."
          />
          <Feature
            icon={Calculator}
            title="Fórmulas à mostra"
            text="Cada cálculo aparece em três etapas: fórmula simbólica → substituição com unidades → resultado."
          />
          <Feature
            icon={ShieldCheck}
            title="Sem chutes"
            text="Campo vazio nunca recebe valor 'típico'. Aparece como Dados Insuficientes listando o que falta."
          />
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        FrioFlow · Balanço térmico em refrigeração industrial · pt-BR
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Snowflake; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
