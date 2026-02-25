import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";

export default function Vendas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "parcelas" ? "parcelas" : "vendas";

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["sales", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(nome)")
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: installments = [], isLoading: instLoading } = useQuery({
    queryKey: ["installments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, customers(nome)")
        .order("vencimento_data");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const inst = installments.find(i => i.id === id);
      const { error } = await supabase.from("installments").update({ status: "pago", pago_em: today, pago_valor: inst?.valor_parcela }).eq("id", id);
      if (error) throw error;
      // register cash movement
      if (inst) {
        await supabase.from("cash_movements").insert({
          user_id: user!.id,
          tipo: "entrada",
          valor: inst.valor_parcela,
          origem: "parcela",
          ref_id: id,
          descricao: `Parcela ${inst.numero_parcela}/${inst.total_parcelas}`,
          data: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Parcela marcada como paga!" });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vendas / Parcelas</h1>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma venda registrada</TableCell></TableRow>
                  ) : sales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{format(new Date(s.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{(s as any).customers?.nome ?? "—"}</TableCell>
                      <TableCell>{formatBRL(s.total_venda)}</TableCell>
                      <TableCell className="capitalize">{s.forma_pagamento}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parcelas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : installments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma parcela registrada</TableCell></TableRow>
                  ) : installments.map(i => (
                    <TableRow key={i.id}>
                      <TableCell>{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{(i as any).customers?.nome ?? "—"}</TableCell>
                      <TableCell>{i.numero_parcela}/{i.total_parcelas}</TableCell>
                      <TableCell>{formatBRL(i.valor_parcela)}</TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                      <TableCell>
                        {i.status === "pendente" && (
                          <Button size="sm" variant="ghost" className="gap-1 text-success" onClick={() => markPaid.mutate(i.id)} disabled={markPaid.isPending}>
                            <CheckCircle className="h-4 w-4" />Pagar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
