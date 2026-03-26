import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search, Mail, MessageCircle, Eye, Pencil, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { CustomerDetail } from "@/components/CustomerDetail";
import { motion } from "framer-motion";

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
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        nome, whatsapp: whatsapp || null, email: email || null, observacoes: obs || null, user_id: user!.id,
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

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; nome: string; whatsapp: string; email: string; observacoes: string }) => {
      const { error } = await supabase.from("customers").update({
        nome: data.nome, whatsapp: data.whatsapp || null, email: data.email || null, observacoes: data.observacoes || null,
      }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente atualizado!" });
      setEditingCustomer(null);
    },
    onError: () => toast({ title: "Erro ao atualizar cliente", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente excluído!" });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Erro ao excluir cliente. Verifique se não há vendas vinculadas.", variant: "destructive" }),
  });

  const filtered = customers.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer({ id: c.id, nome: c.nome, whatsapp: c.whatsapp || "", email: c.email || "", observacoes: c.observacoes || "" });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{customers.length} clientes cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 gradient-primary shadow-glow"><UserPlus className="h-4 w-4" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" className="h-10" /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" className="h-10" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-10" /></div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} className="resize-none" rows={3} /></div>
              <Button className="w-full h-10 gradient-primary" disabled={!nome || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Salvando..." : "Salvar Cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 bg-card border-border/50" />
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Contato</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-24 text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-primary/5 transition-colors group" onClick={() => setSelectedCustomer({ id: c.id, nome: c.nome })}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{c.nome.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.nome}</p>
                        {c.observacoes && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{c.observacoes}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.whatsapp && (
                        <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-success hover:underline bg-success/10 px-2 py-1 rounded-md" onClick={e => e.stopPropagation()}>
                          <MessageCircle className="h-3 w-3" />{c.whatsapp}
                        </a>
                      )}
                      {c.email && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          <Mail className="h-3 w-3" />{c.email}
                        </span>
                      )}
                      {!c.whatsapp && !c.email && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.status === "ativo" ? "default" : "secondary"} className={c.status === "ativo" ? "bg-success/10 text-success border-success/20" : ""}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openEdit(c, e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedCustomer({ id: c.id, nome: c.nome }); }}><Eye className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(v) => { if (!v) setEditingCustomer(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          {editingCustomer && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input value={editingCustomer.nome} onChange={e => setEditingCustomer((p: any) => ({ ...p, nome: e.target.value }))} className="h-10" /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={editingCustomer.whatsapp} onChange={e => setEditingCustomer((p: any) => ({ ...p, whatsapp: e.target.value }))} className="h-10" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={editingCustomer.email} onChange={e => setEditingCustomer((p: any) => ({ ...p, email: e.target.value }))} className="h-10" /></div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea value={editingCustomer.observacoes} onChange={e => setEditingCustomer((p: any) => ({ ...p, observacoes: e.target.value }))} className="resize-none" rows={3} /></div>
              <Button className="w-full h-10 gradient-primary" disabled={!editingCustomer.nome || updateMutation.isPending} onClick={() => updateMutation.mutate(editingCustomer)}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir Cliente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCustomer && (
        <CustomerDetail customerId={selectedCustomer.id} customerName={selectedCustomer.nome} onClose={() => setSelectedCustomer(null)} />
      )}
    </motion.div>
  );
}
