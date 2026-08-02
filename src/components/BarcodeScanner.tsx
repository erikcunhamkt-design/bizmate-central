import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { beep, isCameraScanSupported, normalizeBarcode } from "@/lib/barcode";
import { CameraOff, ScanBarcode } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"];

export function BarcodeScanner({ open, onOpenChange, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isCameraScanSupported();

  useEffect(() => {
    if (!open || !supported) return;

    let cancelled = false;
    let raf = 0;

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    (async () => {
      try {
        const BD = (window as any).BarcodeDetector;
        const available: string[] = (await BD.getSupportedFormats?.()) || FORMATS;
        const detector = new BD({ formats: FORMATS.filter((f) => available.includes(f)) });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results?.length) {
              const code = normalizeBarcode(results[0].rawValue || "");
              if (code) {
                beep(true);
                onDetected(code);
                onOpenChange(false);
                stop();
                return;
              }
            }
          } catch {
            /* frame inválido, tenta o próximo */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "Permissão da câmera negada. Libere o acesso no navegador."
            : "Não foi possível abrir a câmera neste dispositivo.",
        );
      }
    })();

    return stop;
  }, [open, supported, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-4 w-4 text-primary" />
            Escanear código de barras
          </DialogTitle>
        </DialogHeader>

        {!supported ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-warning">
              <CameraOff className="h-4 w-4" />
              <span className="font-semibold">Câmera não suportada neste navegador</span>
            </div>
            <p>
              Use um leitor de código de barras USB ou Bluetooth (ele digita o código automaticamente no campo) ou
              digite o código manualmente. No celular, o Chrome para Android costuma suportar a leitura pela câmera.
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Entendi</Button>
          </div>
        ) : error ? (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">{error}</p>
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-black aspect-[4/3]">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-primary/80" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Aponte a câmera para o código de barras do produto.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
