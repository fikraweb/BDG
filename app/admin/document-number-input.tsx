"use client";
import { useEffect, useState } from "react";

// Keep the text being edited separate from the numeric draft. An empty input
// must stay empty while typing, even though the calculation temporarily uses 0.
export default function DocumentNumberInput({ value, onValueChange, min, max, step }: { value: number; onValueChange: (value: number) => void; min: number; max: number; step: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(current => Number(current) === value ? current : String(value)); }, [value]);
  return <input type="number" required min={min} max={max} step={step} value={text}
    onChange={event => { const next = event.target.value.replace(/^0+(?=\d)/, ""); setText(next); onValueChange(next === "" ? 0 : Number(next)); }}
    onBlur={() => { if (text === "") setText("0"); }}/>
}
