import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { differenceInDays, format } from "date-fns";
import { MessageCircle, Clock, AlertTriangle } from "lucide-react";

export function InactiveClientsWhatsApp() {
  const { user } = useAuth();

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

  const buildWhatsAppUrl = (phone: string, name: string, days: number | null) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = days !== null
      ? `Olá ${name}! 😊 Faz ${days} dias que não nos vemos! Temos novidades incríveis para você. Que tal dar uma passadinha? Estamos com condições especiais! 🎉`
      : `Olá ${name}! 😊 Sentimos sua falta! Temos novidades incríveis esperando por você. Que tal conhecer? Estamos com condições especiais! 🎉`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
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
        <span className="text-xs text-muted-foreground">Clique para enviar lembrete</span>
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
              <a
                href={buildWhatsAppUrl(c.whatsapp!, c.nome, c.daysSince)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Enviar
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
