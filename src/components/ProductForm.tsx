import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ProductPhotoUpload } from "@/components/ProductPhotoUpload";

interface ProductFormData {
  nome: string;
  custo_unitario: string;
  preco_padrao: string;
  estoque_atual: string;
  alerta_estoque_minimo: string;
  categoria: string;
  sku: string;
  foto_url: string;
  validade: string;
}


interface ProductFormProps {
  data: ProductFormData;
  setData: (fn: (prev: ProductFormData) => ProductFormData) => void;
  onSave: () => void;
  isPending: boolean;
  buttonLabel: string;
}

export function ProductForm({ data, setData, onSave, isPending, buttonLabel }: ProductFormProps) {
  const custo = Number(data.custo_unitario) || 0;
  const preco = Number(data.preco_padrao) || 0;
  const margem = preco > 0 ? ((preco - custo) / preco * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Photo upload */}
      <div className="flex justify-center">
        <ProductPhotoUpload
          currentUrl={data.foto_url || null}
          onUpload={(url) => setData((f) => ({ ...f, foto_url: url }))}
          onRemove={() => setData((f) => ({ ...f, foto_url: "" }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Nome do Produto *</Label>
        <Input
          value={data.nome}
          onChange={e => setData(f => ({ ...f, nome: e.target.value }))}
          placeholder="Ex: Camiseta Premium"
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Custo Unitário *</Label>
          <Input
            type="number"
            step="0.01"
            value={data.custo_unitario}
            onChange={e => setData(f => ({ ...f, custo_unitario: e.target.value }))}
            placeholder="0.00"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Preço de Venda *</Label>
          <Input
            type="number"
            step="0.01"
            value={data.preco_padrao}
            onChange={e => setData(f => ({ ...f, preco_padrao: e.target.value }))}
            placeholder="0.00"
            className="h-10"
          />
        </div>
      </div>

      {/* Live margin preview */}
      {custo > 0 && preco > 0 && (
        <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-center ${
          margem >= 30 ? "bg-success/10 text-success" : margem >= 15 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
        }`}>
          Margem estimada: {margem.toFixed(1)}% • Lucro: R$ {(preco - custo).toFixed(2)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Estoque Atual</Label>
          <Input
            type="number"
            value={data.estoque_atual}
            onChange={e => setData(f => ({ ...f, estoque_atual: e.target.value }))}
            placeholder="0"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Alerta Mínimo</Label>
          <Input
            type="number"
            value={data.alerta_estoque_minimo}
            onChange={e => setData(f => ({ ...f, alerta_estoque_minimo: e.target.value }))}
            placeholder="5"
            className="h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
          <Input
            value={data.categoria}
            onChange={e => setData(f => ({ ...f, categoria: e.target.value }))}
            placeholder="Ex: Roupas"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">SKU</Label>
          <Input
            value={data.sku}
            onChange={e => setData(f => ({ ...f, sku: e.target.value }))}
            placeholder="Ex: CAM-001"
            className="h-10"
          />
        </div>
      </div>

      <Button
        className="w-full h-11 gradient-primary font-semibold"
        disabled={!data.nome || !data.custo_unitario || !data.preco_padrao || isPending}
        onClick={onSave}
      >
        {isPending ? "Salvando..." : buttonLabel}
      </Button>
    </div>
  );
}
