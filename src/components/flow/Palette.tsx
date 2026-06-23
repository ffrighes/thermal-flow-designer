import { EQUIPMENT_LIST } from "@/lib/thermal/equipment";

export function Palette() {
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Equipamentos
      </h3>
      {EQUIPMENT_LIST.map((eq) => {
        const Icon = eq.icon;
        return (
          <div
            key={eq.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-equipment", eq.type);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition hover:border-primary hover:bg-accent active:cursor-grabbing"
          >
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">
              {eq.shortLabel}
            </span>
            <span className="ml-auto text-right text-xs">{eq.label}</span>
          </div>
        );
      })}
      <div className="mt-4 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
        Arraste um equipamento para o canvas. Conecte os nós clicando e arrastando entre as
        portas.
      </div>
    </div>
  );
}
