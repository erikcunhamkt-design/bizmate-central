import { Badge } from "@/components/ui/badge";
import { isBefore, isToday, parseISO } from "date-fns";

type Props = { status: string; vencimento?: string };

export function getStatusInfo(status: string, vencimento?: string) {
  if (status === "pago") return { label: "Pago", variant: "success" as const };
  if (status === "parcial") return { label: "Parcial", variant: "primary" as const };
  if (status === "ativa") return { label: "Ativa", variant: "primary" as const };
  if (vencimento) {
    const d = parseISO(vencimento);
    if (isToday(d)) return { label: "Vence hoje", variant: "warning" as const };
    if (isBefore(d, new Date())) return { label: "Atrasado", variant: "destructive" as const };
  }
  return { label: "Pendente", variant: "secondary" as const };
}

export function StatusBadge({ status, vencimento }: Props) {
  const info = getStatusInfo(status, vencimento);
  const colorMap: Record<string, string> = {
    success: "bg-success/15 text-success border-success/20 font-semibold",
    primary: "bg-primary/15 text-primary border-primary/20 font-semibold",
    warning: "bg-warning/15 text-warning border-warning/20 font-semibold",
    destructive: "bg-destructive/15 text-destructive border-destructive/20 font-semibold",
    secondary: "bg-secondary text-secondary-foreground font-medium",
  };
  return (
    <Badge variant="outline" className={`text-[11px] ${colorMap[info.variant]}`}>
      {info.label}
    </Badge>
  );
}
