"use client";

import { useRef, useState, type FormEvent } from "react";
import { type ExtraService, isServiceRequestKind } from "@/lib/buyer-services";
import type { Company } from "@/lib/company";

function ServiceRequestForm({ kind }: { kind: "caution" | "echanges" | "autres" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const key = useRef<string | null>(null);
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    pending.current = true;
    setBusy(true);
    setError("");
    setReference("");
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), kind, key: key.current }),
      });
      const data = await response.json() as { error?: string; reference: string };
      if (!response.ok) throw new Error(data.error);
      setReference(data.reference);
      form.reset();
      key.current = null;
    } catch (error) {
      setError((error as Error).message || "Impossible d’enregistrer la demande.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <form className="form-section buyer-service-form" onSubmit={submit} onChange={() => { key.current = null; setReference(""); }}>
    {kind === "echanges" && <p>Indiquez le sujet de l’échange. Votre message est transmis à l’équipe BDG, qui peut vous recontacter.</p>}
    <fieldset disabled={busy}>
      <label className="field">{kind === "caution" ? "Référence du marché ou objet de la demande" : "Objet"}<input name="subject" required maxLength={160}/></label>
      <label className="field">{kind === "caution" ? "Détails de la caution demandée" : "Message"}<textarea name="message" rows={5} required maxLength={3000}/></label>
      <button className="primary-button">{busy ? "Enregistrement…" : "Envoyer la demande"}</button>
    </fieldset>
    {reference && <p role="status">Demande enregistrée · {reference}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}

export default function BuyerService({ service, company }: { service: ExtraService; company: Company }) {
  if (isServiceRequestKind(service)) return <ServiceRequestForm key={service} kind={service}/>;
  if (service === "reglementation") return <section className="form-section buyer-service-form">
    <h2>Sources officielles</h2>
    <ul>
      <li><a href="https://www.marchespublics.gov.ma/" target="_blank" rel="noreferrer">Portail marocain des marchés publics</a></li>
      <li><a href="https://www.sgg.gov.ma/BulletinOfficiel.aspx" target="_blank" rel="noreferrer">Bulletin officiel · Secrétariat général du gouvernement</a></li>
    </ul>
  </section>;

  const fields = [
    ["Société", company.name],
    ["ICE", company.ice],
    ["Adresse", company.address],
    ["Téléphone", company.phone],
  ].filter(([, value]) => value);
  return <section className="form-section buyer-service-form">
    <h2>Informations sur la société</h2>
    <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>Aucune référence de projet publiée pour le moment.</p>
  </section>;
}
