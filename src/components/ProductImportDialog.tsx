import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/currency";
import { parseNFeXml } from "@/lib/nfeXml";
import { downloadCsvTemplate, parseProductsCsv, type ImportRow } from "@/lib/productImport";
import { generateSku } from "@/lib/barcode";
import { Download, FileUp, Trash2, Upload, AlertTriangle } from "lucide-react";

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: any[];
}

export function ProductImportDialog({ open, onOpenChange, existingProducts }: ProductImportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [origem, setOrigem] = useState("");
  const [markup, setMarkup] = useState("60");

  const byBarcode = new Map(existingProducts.filter((p) => p.codigo_barras).map((p) => [String(p.codigo_barras), p]));

  const reset = () => {
    setRows([]);
    setOrigem("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    try {
      const content = await file.text();
      if (file.name.toLowerCase().endsWith(".xml")) {
        const nfe = parseNFeXml(content);
        setOrigem(`NF-e ${nfe.numero} • ${nfe.emitente}`);
        setRows(nfe.itens);
      } else {
        setRows(parseProductsCsv(content));
        setOrigem(file.name);
      }
    } catch (e: any) {
      toast({ title: e?.message || "Não foi possível ler o arquivo", variant: "destructive" });
    }
  };

  const applyMarkup = () => {
    const factor = 1 + (Number(markup) || 0) / 100;
    setRows((rs) => rs.map((r) => ({ ...r, preco_padrao: Number((r.custo_unitario * factor).toFixed(2)) })));
  };

  const update = (index: number, patch: Partial<ImportRow>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const importMutation = useMutation({
    mutationFn: async () => {
      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const existing = row.codigo_barras ? byBarcode.get(row.codigo_barras) : null;
        const payload = {
          nome: row.nome,
          codigo_barras: row.codigo_barras || null,
          sku: row.sku || generateSku(row.nome, row.categoria),
          categoria: row.categoria || null,
          marca: row.marca || null,
          unidade: row.unidade || "UN",
          ncm: row.ncm || null,
          fornecedor: row.fornecedor || null,
          descricao: row.descricao || null,
          custo_unitario: row.custo_unitario,
          preco_padrao: row.preco_padrao,
          alerta_estoque_minimo: row.alerta_estoque_minimo || 5,
          validade: row.validade || null,
        };

        if (existing) {
          const { error } = await supabase
            .from("products")
            .update({ ...payload, estoque_atual: (existing.estoque_atual || 0) + row.estoque_atual })
            .eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from("products")
            .insert({ ...payload, estoque_atual: row.estoque_atual, user_id: user!.id });
          if (error) throw error;
          created++;
        }
      }
      return { created, updated };
    },
    onSuccess: ({ created, updated }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: `Importação concluída`, description: `${created} criados • ${updated} atualizados` });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro na importação", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" />
            Importar produtos (XML de NF-e ou CSV)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Arquivo</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".xml,.csv,text/csv,text/xml,application/xml"
                className="h-10 w-64"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
            <Button variant="outline" className="gap-1.5 h-10" onClick={downloadCsvTemplate}>
              <Download className="h-3.5 w-3.5" />Modelo CSV
            </Button>
            {rows.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Markup %</Label>
                  <Input type="number" value={markup} onChange={(e) => setMarkup(e.target.value)} className="h-10 w-24" />
                </div>
                <Button variant="outline" className="h-10" onClick={applyMarkup}>Aplicar preço</Button>
              </div>
            )}
          </div>

          {origem && <p className="text-xs text-muted-foreground">Origem: {origem} • {rows.length} itens</p>}

          {rows.length > 0 && (
            <>
              <div className="max-h-[45vh] overflow-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">Produto</TableHead>
                      <TableHead className="font-semibold">Código de barras</TableHead>
                      <TableHead className="font-semibold w-24">Qtd</TableHead>
                      <TableHead className="font-semibold w-28">Custo</TableHead>
                      <TableHead className="font-semibold w-28">Venda</TableHead>
                      <TableHead className="font-semibold w-32">Validade</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => {
                      const existing = row.codigo_barras ? byBarcode.get(row.codigo_barras) : null;
                      return (
                        <TableRow key={i}>
                          <TableCell className="min-w-[220px]">
                            <Input value={row.nome} onChange={(e) => update(i, { nome: e.target.value })} className="h-8" />
                            {existing && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-warning">
                                <AlertTriangle className="h-3 w-3" /> Já existe — o estoque será somado
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input value={row.codigo_barras} onChange={(e) => update(i, { codigo_barras: e.target.value.replace(/\D/g, "") })} className="h-8 font-mono" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={row.estoque_atual} onChange={(e) => update(i, { estoque_atual: Number(e.target.value) })} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={row.custo_unitario} onChange={(e) => update(i, { custo_unitario: Number(e.target.value) })} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={row.preco_padrao} onChange={(e) => update(i, { preco_padrao: Number(e.target.value) })} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input type="date" value={row.validade} onChange={(e) => update(i, { validade: e.target.value })} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Custo total: <strong>{formatBRL(rows.reduce((a, r) => a + r.custo_unitario * r.estoque_atual, 0))}</strong>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset}>Limpar</Button>
                  <Button
                    className="gap-1.5 gradient-primary font-semibold"
                    disabled={importMutation.isPending || rows.some((r) => !r.nome)}
                    onClick={() => importMutation.mutate()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {importMutation.isPending ? "Importando..." : `Importar ${rows.length} produtos`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
