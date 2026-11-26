"use client";
import { useId, useState } from "react";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from "@/components/ui/combobox";
import { MOROCCAN_CITIES, matchesCity, type MoroccanCity } from "@/lib/moroccan-cities";

export default function CityField({ name = "city", label = "Ville", defaultValue = "", value, onValueChange, className = "", disabled = false }: { name?: string; label?: string; defaultValue?: string; value?: string; onValueChange?: (city: string) => void; className?: string; disabled?: boolean }) {
  const id = useId(), [local, setLocal] = useState(defaultValue);
  const city = value ?? local;
  function change(next: string) { setLocal(next); onValueChange?.(next); }
  return <div className={`field city-field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <Combobox<MoroccanCity> items={MOROCCAN_CITIES} value={MOROCCAN_CITIES.find(item => item.name === city) ?? null} inputValue={city} onInputValueChange={(next, details) => {
      // Closing a selection combobox normally restores its selected label.
      // Keep the customer's text so a city outside the list remains valid.
      if (details.reason === "none" || details.reason === "input-clear") { details.cancel(); return; }
      change(next);
    }} onValueChange={next => { if (next) change(next.name); }} itemToStringLabel={item => item.name} filter={matchesCity} limit={80} disabled={disabled}>
      <ComboboxInput id={id} name={name} className="city-control" aria-label={label} required maxLength={120} autoComplete="address-level2" disabled={disabled} placeholder="Rechercher ou écrire votre ville"/>
      <ComboboxContent className="city-options"><ComboboxEmpty>Aucune ville trouvée. Gardez le nom saisi.</ComboboxEmpty><ComboboxList>{item => <ComboboxItem key={item.name} value={item}><span>{item.name}</span><small lang="ar" dir="rtl">{item.arabic}</small></ComboboxItem>}</ComboboxList></ComboboxContent>
    </Combobox>
    <small className="city-help">Votre ville n’est pas dans la liste ? Écrivez son nom.</small>
  </div>;
}
