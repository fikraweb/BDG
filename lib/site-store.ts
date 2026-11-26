import { REMISE_RATE } from "@/lib/catalog";
import type { SiteSettings } from "@/lib/site-types";
import { COMPANY, type Company } from "@/lib/company";
import { ApiError, db, emailField, phoneField, textField } from "@/lib/server";
type SettingsRow = { value: string; revision: number };
export async function readSettings(): Promise<SiteSettings> {
  let row = await db().prepare("SELECT value,revision FROM site_settings WHERE id='main'").first<SettingsRow>();
  if (!row) {
    await db().prepare("INSERT OR IGNORE INTO site_settings (id,value,revision,updated_at) VALUES ('main',?,1,?)")
      .bind(JSON.stringify({ company: COMPANY, remiseRate: REMISE_RATE }), Date.now()).run();
    row = await db().prepare("SELECT value,revision FROM site_settings WHERE id='main'").first<SettingsRow>();
  }
  if (!row) throw new Error("Site settings unavailable");
  return { ...JSON.parse(row.value), revision: row.revision };
}

function cleanText(value: unknown, label: string, max: number) {
  const text = textField(value, label, max);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new ApiError(label + " contient un caractère invalide.");
  return text;
}
function revision(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new ApiError("Version invalide. Actualisez la page.");
  return Number(value);
}
export async function saveSettings(body: Record<string, unknown>) {
  await readSettings();
  if (!body.company || typeof body.company !== "object" || Array.isArray(body.company)) throw new ApiError("Informations de société invalides.");
  const input = body.company as Record<string, unknown>;
  const company: Company = {
    name: cleanText(input.name, "Le nom de l’entreprise", 100), address: textField(input.address, "L’adresse", 400),
    phone: phoneField(input.phone), email: emailField(input.email),
    rib: cleanText(input.rib, "Le RIB", 60), taxeProfessionnelle: cleanText(input.taxeProfessionnelle, "Le N° TP", 40),
    cnss: cleanText(input.cnss, "Le N° CNSS", 40), ice: cleanText(input.ice, "L’ICE", 40),
  };
  const rate = body.remiseRate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 100 || Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-8) throw new ApiError("La remise doit être comprise entre 0 et 100 %, avec deux décimales au maximum.");
  const result = await db().prepare("UPDATE site_settings SET value=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=?").bind(JSON.stringify({ company, remiseRate: rate }), Date.now(), revision(body.revision)).run();
  if (!result.meta.changes) throw new ApiError("Les paramètres ont changé dans une autre fenêtre. Actualisez avant d’enregistrer.", 409);
}
