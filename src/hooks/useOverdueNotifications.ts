import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

export function useOverdueNotifications() {
  const { user } = useAuth();
  const hoje = format(new Date(), "yyyy-MM-dd");
  const notified = useRef(false);

  const { data: overdueInstallments } = useQuery({
    queryKey: ["overdue-notifications", user?.id, hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, customers(nome)")
        .eq("status", "pendente")
        .lte("vencimento_data", hoje);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // check every 5 min
  });

  useEffect(() => {
    if (!overdueInstallments || overdueInstallments.length === 0 || notified.current) return;
    notified.current = true;

    const overdueCount = overdueInstallments.filter(
      (i) => i.vencimento_data < hoje
    ).length;
    const todayCount = overdueInstallments.filter(
      (i) => i.vencimento_data === hoje
    ).length;

    // In-app toast notifications
    if (overdueCount > 0) {
      toast.error(`⚠️ ${overdueCount} parcela${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}!`, {
        description: "Verifique os clientes com pagamentos pendentes.",
        duration: 8000,
      });
    }

    if (todayCount > 0) {
      toast.warning(`📅 ${todayCount} parcela${todayCount > 1 ? "s" : ""} vence${todayCount > 1 ? "m" : ""} hoje!`, {
        description: "Confira os vencimentos do dia.",
        duration: 8000,
      });
    }

    // Browser push notification
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    if ("Notification" in window && Notification.permission === "granted") {
      if (overdueCount > 0) {
        new Notification("BizMate - Parcelas Atrasadas", {
          body: `Você tem ${overdueCount} parcela${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}!`,
          icon: "/pwa-icon-192.png",
        });
      }
      if (todayCount > 0) {
        new Notification("BizMate - Vencimentos Hoje", {
          body: `${todayCount} parcela${todayCount > 1 ? "s" : ""} vence${todayCount > 1 ? "m" : ""} hoje.`,
          icon: "/pwa-icon-192.png",
        });
      }
    }
  }, [overdueInstallments, hoje]);
}
