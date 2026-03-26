import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X, Package } from "lucide-react";

interface ProductPhotoUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
  size?: "sm" | "md";
}

export function ProductPhotoUpload({ currentUrl, onUpload, onRemove, size = "md" }: ProductPhotoUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imgSize = size === "sm" ? "w-12 h-12" : "w-20 h-20";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("product-photos")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      onUpload(urlData.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {currentUrl ? (
        <div className="relative group">
          <img
            src={currentUrl}
            alt="Produto"
            className={`${imgSize} rounded-xl object-cover border border-border/50 shadow-sm`}
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className={`${imgSize} rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors`}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className={`${iconSize} text-muted-foreground animate-spin`} />
          ) : (
            <Package className={`${iconSize} text-muted-foreground`} />
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          {uploading ? "Enviando..." : currentUrl ? "Trocar" : "Foto"}
        </Button>
        <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP. 5MB</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
