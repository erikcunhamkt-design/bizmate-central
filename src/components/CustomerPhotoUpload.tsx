import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";

interface CustomerPhotoUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export function CustomerPhotoUpload({ currentUrl, onUpload, onRemove }: CustomerPhotoUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) return; // 5MB max

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("customer-photos")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("customer-photos")
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
        <div className="relative">
          <img src={currentUrl} alt="Foto" className="w-16 h-16 rounded-xl object-cover border border-border/50" />
          <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center">
          <Camera className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {uploading ? "Enviando..." : currentUrl ? "Trocar foto" : "Enviar foto"}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG ou WebP. Máx 5MB.</p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
    </div>
  );
}
