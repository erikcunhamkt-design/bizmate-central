import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { differenceInDays, format } from "date-fns";
import { MessageCircle, Clock, AlertTriangle, Send, Pencil } from "lucide-react";

export function InactiveClientsWhatsApp() {
  const { user } = useAuth();
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [customMessage, setCustomMessage] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["all-sales-for-inactive", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("customer_id, data_compra").order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const today = new Date();
  const lastPurchaseMap = new Map<string, Date>();
  for (const sale of sales) {
    if (!lastPurchaseMap.has(sale.customer_id)) {
      lastPurchaseMap.set(sale.customer_id, new Date(sale.data_compra));
    }
  }

  const inactiveClients = customers
    .map(c => {
      const lastPurchase = lastPurchaseMap.get(c.id);
      const daysSince = lastPurchase ? differenceInDays(today, lastPurchase) : null;
      return { ...c, lastPurchase, daysSince };
    })
    .filter(c => (c.daysSince !== null && c.daysSince > 30) || c.daysSince === null)
    .filter(c => c.whatsapp)
    .sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999));

  const getDefaultMessage = (name: string, days: number | null) => {
    return days !== null
      ? `Olá ${name}! 😊 Faz ${days} dias que não nos vemos! Temos novidades incríveis para você. Que tal dar uma passadinha? Estamos com condições especiais! 🎉`
      : `Olá ${name}! 😊 Sentimos sua falta! Temos novidades incríveis esperando por você. Que tal conhecer? Estamos com condições especiais! 🎉`;
  };

  const buildWhatsAppUrl = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  };

  const openCustomize = (client: any) => {
    setEditingClient(client);
    setCustomMessage(getDefaultMessage(client.nome, client.daysSince));
  };

  const sendCustomMessage = () => {
    if (!editingClient) return;
    const url = buildWhatsAppUrl(editingClient.whatsapp!, customMessage);
    window.open(url, "_blank");
    setEditingClient(null);
  };

  const sendQuick = (client: any) => {
    const msg = getDefaultMessage(client.nome, client.daysSince);
    const url = buildWhatsAppUrl(client.whatsapp!, msg);
    window.open(url, "_blank");
  };

  if (inactiveClients.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          🎉 Todos os clientes estão ativos! Nenhum cliente inativo há mais de 30 dias.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold">{inactiveClients.length} cliente(s) inativo(s) com WhatsApp</h3>
        </div>
        <span className="text-xs text-muted-foreground">Envie ou personalize o lembrete</span>
      </div>

      <div className="grid gap-2">
        {inactiveClients.map(c => (
          <Card key={c.id} className="border-border/50 hover:border-success/30 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {c.foto_url ? (
                  <img src={c.foto_url} alt={c.nome} className="w-9 h-9 rounded-lg object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-warning">{c.nome.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{c.nome}</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {c.daysSince !== null
                        ? `Última compra há ${c.daysSince} dias (${format(c.lastPurchase!, "dd/MM/yyyy")})`
                        : "Nunca comprou"
                      }
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => openCustomize(c)}>
                  <Pencil className="h-3 w-3" />Personalizar
                </Button>
                <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => sendQuick(c)}>
                  <MessageCircle className="h-3.5 w-3.5" />Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customize message dialog */}
      <Dialog open={!!editingClient} onOpenChange={v => { if (!v) setEditingClient(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-success" />
              </div>
              Mensagem para {editingClient?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Personalize a mensagem antes de enviar:</p>
              <Textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                rows={5}
                className="resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{customMessage.length} caracteres</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => {
                if (editingClient) setCustomMessage(getDefaultMessage(editingClient.nome, editingClient.daysSince));
              }}>
                Restaurar padrão
              </Button>
              <Button className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={sendCustomMessage} disabled={!customMessage.trim()}>
                <Send className="h-3.5 w-3.5" />Enviar WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
