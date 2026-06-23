import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const nodeSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  tag: z.string(),
  pos_x: z.number(),
  pos_y: z.number(),
  parametros: z.record(z.unknown()).default({}),
});

const edgeSchema = z.object({
  id: z.string(),
  source_node: z.string(),
  target_node: z.string(),
  material: z.string(),
  parametros: z.record(z.unknown()).default({}),
});

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, nome, descricao, updated_at, created_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ nome: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({ nome: data.nome, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), nome: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ nome: data.nome })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("id, nome, descricao, updated_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: nodes } = await context.supabase
      .from("nodes")
      .select("*")
      .eq("project_id", data.id);
    const { data: edges } = await context.supabase
      .from("edges")
      .select("*")
      .eq("project_id", data.id);
    return { project, nodes: nodes ?? [], edges: edges ?? [] };
  });

export const saveProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().trim().min(1).max(120).optional(),
        nodes: z.array(nodeSchema),
        edges: z.array(edgeSchema),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.nome) {
      const { error } = await supabase
        .from("projects")
        .update({ nome: data.nome })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    // Estratégia simples: apaga e re-insere nós/arestas
    await supabase.from("edges").delete().eq("project_id", data.id);
    await supabase.from("nodes").delete().eq("project_id", data.id);
    if (data.nodes.length) {
      const { error: nErr } = await supabase.from("nodes").insert(
        data.nodes.map((n) => ({
          id: n.id,
          project_id: data.id,
          tipo: n.tipo,
          tag: n.tag,
          pos_x: n.pos_x,
          pos_y: n.pos_y,
          parametros: n.parametros,
        })),
      );
      if (nErr) throw new Error(nErr.message);
    }
    if (data.edges.length) {
      const { error: eErr } = await supabase.from("edges").insert(
        data.edges.map((e) => ({
          id: e.id,
          project_id: data.id,
          source_node: e.source_node,
          target_node: e.target_node,
          material: e.material,
          parametros: e.parametros,
        })),
      );
      if (eErr) throw new Error(eErr.message);
    }
    return { ok: true, savedAt: new Date().toISOString() };
  });
