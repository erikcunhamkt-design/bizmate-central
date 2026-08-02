import { forwardRef, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { beep, isValidGtin, normalizeBarcode } from "@/lib/barcode";
import { ScanBarcode, Check, AlertTriangle } from "lucide-react";

interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando o leitor físico finaliza a leitura (Enter) ou a câmera detecta */
  onScan?: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  showValidation?: boolean;
}

/**
 * Campo de código de barras compatível com leitores USB/Bluetooth (que digitam e
 * enviam Enter) e com leitura pela câmera.
 */
export const BarcodeInput = forwardRef<HTMLInputElement, BarcodeInputProps>(function BarcodeInput(
  { value, onChange, onScan, placeholder = "Bipe ou digite o código de barras", autoFocus, className, showValidation = true },
  ref,
) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const lastKeyTime = useRef(0);
  const fastKeys = useRef(0);

  const valid = value ? isValidGtin(value) : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastKeyTime.current < 40) fastKeys.current += 1;
    else if (e.key.length === 1) fastKeys.current = 1;
    lastKeyTime.current = now;

    if (e.key === "Enter") {
      e.preventDefault();
      const code = normalizeBarcode((e.target as HTMLInputElement).value);
      if (code) {
        beep(true);
        onChange(code);
        onScan?.(code);
      }
      fastKeys.current = 0;
    }
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className || ""}`}>
        <div className="relative flex-1">
          <Input
            ref={ref}
            inputMode="numeric"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-10 pr-8 font-mono"
          />
          {showValidation && value.length > 5 && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {valid ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
            </span>
          )}
        </div>
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setScannerOpen(true)} title="Escanear com a câmera">
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => {
          onChange(code);
          onScan?.(code);
        }}
      />
    </>
  );
});
