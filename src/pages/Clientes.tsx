import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search, Phone } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { formatBRL } from "@/lib/currency";
import { CustomerDetail } from "@/components/CustomerDetail";

export default function Clientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(searchParams.get("novo") === "1");
  const [search, setSearch] = useState("");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; nome: string } | null>(null);
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        nome,
        whatsapp: whatsapp || null,
        email: email || null,
        observacoes: obs || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente criado com sucesso!" });
      setOpen(false);
      setNome(""); setWhatsapp(""); setEmail(""); setObs("");
    },
    onError: () => toast({ title: "Erro ao criar cliente", variant: "destructive" }),
  });

  const filtered = customers.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" /></div>
              <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" /></div>
              <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
              <div><Label>Observações</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} /></div>
              <Button className="w-full" disabled={!nome || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCustomer({ id: c.id, nome: c.nome })}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    {c.whatsapp ? (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-primary hover:underline" onClick={e => e.stopPropagation()}>
                        <Phone className="h-3 w-3" />{c.whatsapp}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "ativo" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {selectedCustomer && (
        <CustomerDetail
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.nome}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
