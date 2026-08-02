export function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "");
}

/** Valida o dígito verificador de EAN-8/EAN-13/UPC-A/GTIN-14 */
export function isValidGtin(code: string) {
  const digits = onlyDigits(code);
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const nums = digits.split("").map(Number);
  const check = nums.pop() as number;
  let sum = 0;
  nums.reverse().forEach((n, i) => {
    sum += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

export function normalizeBarcode(code: string) {
  const digits = onlyDigits(code);
  return digits || (code || "").trim();
}

const STOPWORDS = new Set(["de", "da", "do", "para", "com", "e", "a", "o"]);

export function generateSku(nome: string, categoria?: string) {
  const slug = (text: string, take: number) =>
    (text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
      .map((w) => w.slice(0, take))
      .join("")
      .slice(0, 8);

  const base = [slug(categoria || "", 3), slug(nome, 4)].filter(Boolean).join("-");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || "PROD"}-${rand}`;
}

/** Bipe curto + vibração para confirmar a leitura */
export function beep(ok = true) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = ok ? 1180 : 300;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, ok ? 90 : 220);
    }
  } catch {
    /* áudio indisponível */
  }
  try {
    navigator.vibrate?.(ok ? 40 : [60, 40, 60]);
  } catch {
    /* vibração indisponível */
  }
}

export function isCameraScanSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
}
