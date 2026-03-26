import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "@/lib/currency";
import { Target, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  entradas: number;
}

export function RevenueGoalCard({ entradas }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const { data: goal } = useQuery({
    queryKey: ["revenue-goal", user?.id, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_goals")
        .select("*")
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await supabase.from("revenue_goals").upsert(
        { user_id: user!.id, mes, ano, meta_valor: valor, updated_at: new Date().toISOString() },
        { onConflict: "user_id,mes,ano" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue-goal"] });
      setEditing(false);
      toast.success("Meta atualizada!");
    },
    onError: () => toast.error("Erro ao salvar meta"),
  });

  const metaValor = goal?.meta_valor ?? 0;
  const progress = metaValor > 0 ? Math.min((entradas / metaValor) * 100, 100) : 0;
  const remaining = Math.max(metaValor - entradas, 0);

  const handleSave = () => {
    const val = parseFloat(inputValue.replace(/\D/g, "")) / 100;
    if (!val || val <= 0) return;
    upsert.mutate(val);
  };

  const startEdit = () => {
    setInputValue(metaValor > 0 ? (metaValor * 100).toFixed(0) : "");
    setEditing(true);
  };

  const progressColor = progress >= 100
    ? "bg-success"
    : progress >= 70
    ? "bg-primary"
    : progress >= 40
    ? "bg-warning"
    : "bg-destructive";

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Meta de Faturamento — {now.toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, c => c.toUpperCase())}/{ano}</CardTitle>
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">R$</span>
            <Input
              autoFocus
              placeholder="10.000,00"
              value={inputValue ? (parseFloat(inputValue) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
              onChange={(e) => setInputValue(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-8 text-sm"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : metaValor === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">Defina sua meta de faturamento mensal</p>
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-2">
              <Target className="h-3.5 w-3.5" />
              Definir Meta
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight">{formatBRL(entradas)}</p>
                <p className="text-xs text-muted-foreground">de {formatBRL(metaValor)}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${progress >= 100 ? "text-success" : "text-foreground"}`}>
                  {progress.toFixed(1)}%
                </p>
                {progress < 100 && (
                  <p className="text-[11px] text-muted-foreground">Faltam {formatBRL(remaining)}</p>
                )}
                {progress >= 100 && (
                  <p className="text-[11px] text-success font-medium">🎉 Meta atingida!</p>
                )}
              </div>
            </div>
            <Progress value={progress} className="h-3 [&>div]:transition-all [&>div]:duration-500" style={{}} />
            <style>{`
              [data-slot="progress-indicator"] { background: hsl(var(--${progressColor.replace("bg-", "")})) !important; }
            `}</style>
          </>
        )}
      </CardContent>
    </Card>
  );
}
