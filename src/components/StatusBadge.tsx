import { Badge } from "@/components/ui/badge";
import { isBefore, isToday, parseISO } from "date-fns";

type Props = { status: string; vencimento?: string };

export function getStatusInfo(status: string, vencimento?: string) {
  if (status === "pago") return { label: "Pago", variant: "success" as const };
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
    success: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    destructive: "bg-destructive/20 text-destructive border-destructive/30",
    secondary: "bg-secondary text-secondary-foreground",
  };
  return (
    <Badge variant="outline" className={colorMap[info.variant]}>
      {info.label}
    </Badge>
  );
}
