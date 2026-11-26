import { useState } from "react";
import { BANNER_TEXT_LIMIT, FLAG_CODES, flagName, type FlagCode } from "@/lib/access-banners";
import type { SiteSettings } from "@/lib/site-types";

export default function AccessBannersPanel({ settings, locked, onSave }: {
  settings: SiteSettings;
  locked: boolean;
  onSave: (action: string, values: Record<string, unknown>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(settings.accessBanners);
  const [country, setCountry] = useState<FlagCode | "">("");
  const available = FLAG_CODES.filter(code => !draft.flags.includes(code)).sort((a, b) => flagName(a).localeCompare(flagName(b), "fr"));

  return <section className="admin-panel">
    <div className="admin-panel-heading"><h2>Bandeaux de la page d’accès</h2><p>Modifiez les textes défilants et choisissez les drapeaux à afficher dans le bandeau supérieur.</p></div>
    <form onSubmit={event => { event.preventDefault(); void onSave("access-banners-save", { ...draft, revision: settings.revision }); }}>
      <fieldset disabled={locked} className="admin-fields">
        <label className="field">Texte sous les drapeaux
          <input required maxLength={BANNER_TEXT_LIMIT} value={draft.brandText} onChange={event => setDraft({ ...draft, brandText: event.target.value })}/>
        </label>
        <label className="field">Texte du bandeau inférieur
          <input required maxLength={BANNER_TEXT_LIMIT} value={draft.welcomeText} onChange={event => setDraft({ ...draft, welcomeText: event.target.value })}/>
        </label>
        <div className="admin-full">
          <label className="field">Ajouter un drapeau
            <select value={country} onChange={event => setCountry(event.target.value as FlagCode | "")}>
              <option value="">Choisissez un pays</option>
              {available.map(code => <option key={code} value={code}>{flagName(code)}</option>)}
            </select>
          </label>
          <button type="button" className="admin-save" disabled={!country} onClick={() => {
            if (!country || draft.flags.includes(country)) return;
            setDraft({ ...draft, flags: [...draft.flags, country] });
            setCountry("");
          }}>Ajouter</button>
          <ul className="admin-flag-list" aria-label="Drapeaux sélectionnés">
            {draft.flags.map(code => <li key={code}>
              <svg aria-hidden="true" width="30" height="20"><use href={`/images/access-flags.svg#${code}`}/></svg>
              <span>{flagName(code)}</span>
              <button type="button" aria-label={`Retirer le drapeau de ${flagName(code)}`} disabled={draft.flags.length === 1} onClick={() => setDraft({ ...draft, flags: draft.flags.filter(flag => flag !== code) })}>Retirer</button>
            </li>)}
          </ul>
        </div>
        <button className="admin-save" type="submit">Enregistrer les bandeaux</button>
      </fieldset>
    </form>
  </section>;
}
