import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatBRL } from "@/lib/currency";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Package, ShoppingCart, X } from "lucide-react";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const { data: customers = [] } = useQuery({
    queryKey: ["search-customers", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, nome, whatsapp, email, status").order("nome");
      return data ?? [];
    },
    enabled: !!user && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["search-products", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, nome, preco_padrao, categoria, estoque_atual").order("nome");
      return data ?? [];
    },
    enabled: !!user && open,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["search-sales", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("id, data_compra, total_venda, forma_pagamento, status, customers(nome)").order("data_compra", { ascending: false }).limit(100);
      return data ?? [];
    },
    enabled: !!user && open,
  });

  const q = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!q) return { customers: [], products: [], sales: [] };
    return {
      customers: customers.filter(c => c.nome.toLowerCase().includes(q) || c.whatsapp?.includes(q) || c.email?.toLowerCase().includes(q)).slice(0, 5),
      products: products.filter(p => p.nome.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q)).slice(0, 5),
      sales: sales.filter(s => (s as any).customers?.nome?.toLowerCase().includes(q) || s.forma_pagamento?.includes(q)).slice(0, 5),
    };
  }, [q, customers, products, sales]);

  const totalResults = results.customers.length + results.products.length + results.sales.length;

  const goTo = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b border-border/50 px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clientes, produtos, vendas..."
            className="border-0 focus-visible:ring-0 h-12 text-sm"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!q && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <p>Digite para buscar em todo o sistema</p>
              <p className="text-xs mt-1 opacity-60">
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+K</kbd> para abrir a qualquer momento
              </p>
            </div>
          )}

          {q && totalResults === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para "{query}"
            </div>
          )}

          {results.customers.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center gap-1.5">
                <User className="h-3 w-3" /> Clientes ({results.customers.length})
              </div>
              {results.customers.map(c => (
                <button key={c.id} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors text-left" onClick={() => goTo("/clientes")}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{c.nome.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.whatsapp || c.email || "Sem contato"} • {c.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.products.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center gap-1.5">
                <Package className="h-3 w-3" /> Produtos ({results.products.length})
              </div>
              {results.products.map(p => (
                <button key={p.id} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors text-left" onClick={() => goTo("/estoque")}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {formatBRL(p.preco_padrao)} • Estoque: {p.estoque_atual}
                      {p.categoria && ` • ${p.categoria}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.sales.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center gap-1.5">
                <ShoppingCart className="h-3 w-3" /> Vendas ({results.sales.length})
              </div>
              {results.sales.map(s => (
                <button key={s.id} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors text-left" onClick={() => goTo("/vendas")}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(s as any).customers?.nome ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {formatBRL(s.total_venda)} • {s.forma_pagamento} • {s.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
