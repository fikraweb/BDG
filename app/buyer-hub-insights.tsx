"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Calculator, FileText } from "lucide-react";
import { calculateRemise, money, type PriceQuote } from "@/lib/catalog";
import { documentLabel, requestStatus, type DocumentRequest } from "@/lib/document-types";

type RecentRequest = Pick<DocumentRequest, "id" | "kind" | "createdAt" | "status" | "hasPdf">;
type RequestFeed = { requests: RecentRequest[] } | { error: true } | null;

const requestDate = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });
const amountFormat = new Intl.NumberFormat("fr-MA");

export default function BuyerHubInsights({ rate, onOpenRemise, onOpenRequests }: {
  rate: number;
  onOpenRemise: () => void;
  onOpenRequests: () => void;
}) {
  const [amount, setAmount] = useState("10000");
  const [feed, setFeed] = useState<RequestFeed>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRequests() {
      try {
        const response = await fetch("/api/documents", { signal: controller.signal });
        if (!response.ok) throw new Error("Demandes indisponibles");
        const data = await response.json() as { requests: RecentRequest[] };
        if (!Array.isArray(data.requests)) throw new Error("Réponse invalide");
        if (!controller.signal.aborted) setFeed({ requests: data.requests.slice(0, 3) });
      } catch {
        if (!controller.signal.aborted) setFeed({ error: true });
      }
    }
    void loadRequests();
    return () => controller.abort();
  }, [attempt]);

  const normalized = amount.trim().replace(/\s+/g, "").replace(",", ".");
  let quote: PriceQuote | undefined;
  let amountError: string | undefined;
  if (normalized) {
    try {
      if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) throw new Error("Saisissez un montant avec deux décimales au maximum.");
      quote = calculateRemise(Number(normalized), rate);
    } catch (error) {
      amountError = error instanceof Error ? error.message : "Montant invalide.";
    }
  }

  return (
    <div className="hub-insights">
      <section className="hub-insight" aria-labelledby="hub-simulator">
        <div className="hub-insight-heading">
          <Calculator size={21} aria-hidden="true" />
          <div>
            <h2 id="hub-simulator">Simuler une remise</h2>
            <p>Estimation au taux en vigueur de {amountFormat.format(rate)} %.</p>
          </div>
        </div>
        <label htmlFor="hub-simulation-amount">Montant de l’achat</label>
        <div className="hub-amount">
          <input id="hub-simulation-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!!amountError} aria-describedby={amountError ? "hub-amount-error" : undefined} />
          <span>MAD</span>
        </div>
        <div className="hub-amount-presets" aria-label="Exemples de montants">
          {[5000, 10000, 25000].map(preset => (
            <button key={preset} type="button" aria-pressed={!!quote && quote.amount === preset} onClick={() => setAmount(String(preset))}>
              {amountFormat.format(preset)} MAD
            </button>
          ))}
        </div>
        {amountError && <p className="hub-amount-error" id="hub-amount-error">{amountError}</p>}
        <div className="hub-quote" aria-live="polite">
          {quote && <>
            <div className="hub-quote-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${quote.net / quote.amount})` }} />
            </div>
            <dl className="hub-quote-values" key={quote.amount}>
              <div><dt>Après remise</dt><dd>{money(quote.net)}</dd></div>
              <div><dt>Remise estimée</dt><dd>{money(quote.discount)}</dd></div>
            </dl>
          </>}
        </div>
        <button className="hub-insight-link" type="button" onClick={onOpenRemise}>Ouvrir la demande de remise <ArrowRight size={16} aria-hidden="true" /></button>
      </section>

      <section className="hub-insight" aria-labelledby="hub-recent-requests">
        <div className="hub-insight-heading">
          <FileText size={21} aria-hidden="true" />
          <div>
            <h2 id="hub-recent-requests">Mes demandes récentes</h2>
            <p>Suivez la préparation de vos documents.</p>
          </div>
        </div>
        <div className="hub-request-feed" aria-live="polite">
          {!feed ? <p>Chargement de vos demandes…</p> : "error" in feed ? (
            <div>
              <p>Vos demandes sont momentanément indisponibles.</p>
              <button className="hub-insight-link" type="button" onClick={() => { setFeed(null); setAttempt(previous => previous + 1); }}>Réessayer</button>
            </div>
          ) : feed.requests.length ? (
            <ul className="hub-request-list">
              {feed.requests.map(request => (
                <li key={request.id}>
                  <div>
                    <strong>{documentLabel(request.kind)}</strong>
                    <time dateTime={new Date(request.createdAt).toISOString()}>{requestDate.format(request.createdAt)}</time>
                  </div>
                  <span className={request.hasPdf ? "hub-request-ready" : undefined}>{requestStatus(request)}</span>
                </li>
              ))}
            </ul>
          ) : <p>Vos demandes de facture et de bon de livraison apparaîtront ici après leur envoi.</p>}
        </div>
        <button className="hub-insight-link" type="button" onClick={onOpenRequests}>Voir mes demandes <ArrowRight size={16} aria-hidden="true" /></button>
      </section>
    </div>
  );
}
