import { useEffect, useState } from "react";

export type OperatorName = "Catia" | "Erik";

const STORAGE_KEY = "bizmate-current-operator";
const DEFAULT_OPERATOR: OperatorName = "Catia";

export function getCurrentOperator(): OperatorName {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "Erik" || stored === "Catia" ? stored : DEFAULT_OPERATOR;
}

export function useOperator() {
  const [operator, setOperatorState] = useState<OperatorName>(() => getCurrentOperator());

  const setOperator = (value: OperatorName) => {
    localStorage.setItem(STORAGE_KEY, value);
    setOperatorState(value);
    window.dispatchEvent(new CustomEvent("operator-change", { detail: value }));
  };

  useEffect(() => {
    const onChange = (event: Event) => setOperatorState((event as CustomEvent<OperatorName>).detail ?? getCurrentOperator());
    window.addEventListener("operator-change", onChange);
    return () => window.removeEventListener("operator-change", onChange);
  }, []);

  return { operator, setOperator };
}