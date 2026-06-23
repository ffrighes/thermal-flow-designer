import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from "@/lib/projects.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { LogOut, Plus, Pencil, Trash2, Snowflake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const remove = useServerFn(deleteProject);
  const rename = useServerFn(renameProject);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: () => list() });

  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: (nome: string) => create({ data: { nome } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setNewName("");
      navigate({ to: "/projects/$id", params: { id: row.id } });
    },
    onError: (e) => toast.error(String(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto excluído.");
    },
  });

  const renameMut = useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      rename({ data: { id, nome } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-primary" />
            <span className="font-semibold">FrioFlow</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Meus projetos</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo projeto</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Nome do projeto"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <DialogFooter>
                <Button
                  onClick={() => createMut.mutate(newName.trim())}
                  disabled={!newName.trim() || createMut.isPending}
                >
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data && data.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <Card key={p.id} className="transition hover:border-primary/60">
                <CardHeader>
                  <CardTitle className="text-base">
                    <Link to="/projects/$id" params={{ id: p.id }}>
                      {p.nome}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    Atualizado em {new Date(p.updated_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <RenameDialog
                      current={p.nome}
                      onConfirm={(nome) => renameMut.mutate({ id: p.id, nome })}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeMut.mutate(p.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Nenhum projeto ainda. Clique em <strong>Novo projeto</strong> para começar.
          </div>
        )}
      </main>
    </div>
  );
}

function RenameDialog({ current, onConfirm }: { current: string; onConfirm: (n: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(current); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Renomear
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear projeto</DialogTitle>
        </DialogHeader>
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button
            onClick={() => {
              onConfirm(val.trim());
              setOpen(false);
            }}
            disabled={!val.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
