import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductPhotoUpload } from "@/components/ProductPhotoUpload";
import { BarcodeInput } from "@/components/BarcodeInput";
import { generateSku } from "@/lib/barcode";
import { UNIDADES } from "@/lib/productImport";
import { AlertTriangle, CalendarClock, Plus, Sparkles, Tag, Trash2, Wallet, Boxes } from "lucide-react";

export interface BatchDraft {
  id?: string;
  lote: string;
  validade: string;
  quantidade: string;
  custo_unitario: string;
}

export interface ProductFormData {
  id?: string;
  nome: string;
  custo_unitario: string;
  preco_padrao: string;
  preco_minimo: string;
  estoque_atual: string;
  alerta_estoque_minimo: string;
  categoria: string;
  sku: string;
  foto_url: string;
  validade: string;
  codigo_barras: string;
  unidade: string;
  marca: string;
  ncm: string;
  fornecedor: string;
  descricao: string;
  ativo: boolean;
  lotes: BatchDraft[];
}

export const emptyProductForm = (): ProductFormData => ({
  nome: "",
  custo_unitario: "",
  preco_padrao: "",
  preco_minimo: "",
  estoque_atual: "",
  alerta_estoque_minimo: "5",
  categoria: "",
  sku: "",
  foto_url: "",
  validade: "",
  codigo_barras: "",
  unidade: "UN",
  marca: "",
  ncm: "",
  fornecedor: "",
  descricao: "",
  ativo: true,
  lotes: [],
});

interface ProductFormProps {
  data: ProductFormData;
  setData: (fn: (prev: ProductFormData) => ProductFormData) => void;
  onSave: () => void;
  isPending: boolean;
  buttonLabel: string;
  /** Usado para avisar sobre código de barras já cadastrado */
  duplicateBarcodeName?: string | null;
}

export function ProductForm({ data, setData, onSave, isPending, buttonLabel, duplicateBarcodeName }: ProductFormProps) {
  const custo = Number(data.custo_unitario) || 0;
  const preco = Number(data.preco_padrao) || 0;
  const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setData((f) => ({ ...f, [key]: value }));

  const updateLote = (index: number, patch: Partial<BatchDraft>) =>
    setData((f) => ({ ...f, lotes: f.lotes.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));

  const totalLotes = data.lotes.reduce((acc, l) => acc + (Number(l.quantidade) || 0), 0);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="identificacao">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identificacao" className="gap-1.5 text-xs"><Tag className="h-3.5 w-3.5" />Identificação</TabsTrigger>
          <TabsTrigger value="precos" className="gap-1.5 text-xs"><Wallet className="h-3.5 w-3.5" />Preços</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-1.5 text-xs"><Boxes className="h-3.5 w-3.5" />Estoque</TabsTrigger>
          <TabsTrigger value="validade" className="gap-1.5 text-xs"><CalendarClock className="h-3.5 w-3.5" />Validade</TabsTrigger>
        </TabsList>

        {/* ---------------- Identificação ---------------- */}
        <TabsContent value="identificacao" className="space-y-4 mt-4">
          <div className="flex justify-center">
            <ProductPhotoUpload
              currentUrl={data.foto_url || null}
              onUpload={(url) => set("foto_url", url)}
              onRemove={() => set("foto_url", "")}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Nome do Produto *</Label>
            <Input value={data.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Camiseta Premium" className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Código de Barras (EAN/GTIN)</Label>
            <BarcodeInput value={data.codigo_barras} onChange={(v) => set("codigo_barras", v)} />
            {duplicateBarcodeName && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertTriangle className="h-3 w-3" /> Já existe um produto com este código: {duplicateBarcodeName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">SKU (automático)</Label>
              <Input
                value={data.sku || autoSkuPreview || ""}
                readOnly
                disabled
                placeholder="Gerado pelo sistema"
                className="h-10 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">O sistema numera em sequência (01, 02, 03...).</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Unidade</Label>
              <Select value={data.unidade || "UN"} onValueChange={(v) => set("unidade", v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
              <Input value={data.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex: Roupas" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Marca</Label>
              <Input value={data.marca} onChange={(e) => set("marca", e.target.value)} placeholder="Ex: Nike" className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">NCM</Label>
            <Input value={data.ncm} onChange={(e) => set("ncm", e.target.value)} placeholder="Ex: 61091000" className="h-10 font-mono" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
            <Textarea value={data.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Detalhes do produto..." rows={3} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Produto ativo</p>
              <p className="text-[11px] text-muted-foreground">Produtos inativos não aparecem para venda.</p>
            </div>
            <Switch checked={data.ativo} onCheckedChange={(v) => set("ativo", v)} />
          </div>
        </TabsContent>

        {/* ---------------- Preços ---------------- */}
        <TabsContent value="precos" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Custo Unitário *</Label>
              <Input type="number" step="0.01" value={data.custo_unitario} onChange={(e) => set("custo_unitario", e.target.value)} placeholder="0.00" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Preço de Venda *</Label>
              <Input type="number" step="0.01" value={data.preco_padrao} onChange={(e) => set("preco_padrao", e.target.value)} placeholder="0.00" className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Preço Mínimo (promoção)</Label>
            <Input type="number" step="0.01" value={data.preco_minimo} onChange={(e) => set("preco_minimo", e.target.value)} placeholder="0.00" className="h-10" />
          </div>

          {custo > 0 && preco > 0 && (
            <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-center ${
              margem >= 30 ? "bg-success/10 text-success" : margem >= 15 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
            }`}>
              Margem estimada: {margem.toFixed(1)}% • Lucro: R$ {(preco - custo).toFixed(2)}
            </div>
          )}
        </TabsContent>

        {/* ---------------- Estoque ---------------- */}
        <TabsContent value="estoque" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Estoque Atual</Label>
              <Input type="number" value={data.estoque_atual} onChange={(e) => set("estoque_atual", e.target.value)} placeholder="0" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Alerta Mínimo</Label>
              <Input type="number" value={data.alerta_estoque_minimo} onChange={(e) => set("alerta_estoque_minimo", e.target.value)} placeholder="5" className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Fornecedor</Label>
            <Input value={data.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} placeholder="Ex: Distribuidora ABC" className="h-10" />
          </div>
        </TabsContent>

        {/* ---------------- Validade / Lotes ---------------- */}
        <TabsContent value="validade" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Validade principal</Label>
            <Input type="date" value={data.validade} onChange={(e) => set("validade", e.target.value)} className="h-10" />
            <p className="text-[11px] text-muted-foreground">Opcional — alertamos 30 dias antes do vencimento.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Lotes ({data.lotes.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setData((f) => ({ ...f, lotes: [...f.lotes, { lote: "", validade: "", quantidade: "", custo_unitario: f.custo_unitario }] }))}
              >
                <Plus className="h-3.5 w-3.5" />Adicionar lote
              </Button>
            </div>

            {data.lotes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Use lotes quando o mesmo produto tem várias datas de validade.
              </p>
            ) : (
              <div className="space-y-2">
                {data.lotes.map((lote, i) => (
                  <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={lote.lote} onChange={(e) => updateLote(i, { lote: e.target.value })} placeholder="Nº do lote" className="h-9" />
                      <Input type="date" value={lote.validade} onChange={(e) => updateLote(i, { validade: e.target.value })} className="h-9" />
                    </div>
                    <div className="flex gap-2">
                      <Input type="number" value={lote.quantidade} onChange={(e) => updateLote(i, { quantidade: e.target.value })} placeholder="Qtd" className="h-9" />
                      <Input type="number" step="0.01" value={lote.custo_unitario} onChange={(e) => updateLote(i, { custo_unitario: e.target.value })} placeholder="Custo" className="h-9" />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => setData((f) => ({ ...f, lotes: f.lotes.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Total em lotes: {totalLotes} {data.unidade}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Button
        className="w-full h-11 gradient-primary font-semibold"
        disabled={!data.nome || !data.custo_unitario || !data.preco_padrao || isPending || !!duplicateBarcodeName}
        onClick={onSave}
      >
        {isPending ? "Salvando..." : buttonLabel}
      </Button>
    </div>
  );
}
