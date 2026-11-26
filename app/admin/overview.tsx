import { BadgePercent, Coins } from "lucide-react";
import type { PayoutRequest } from "@/lib/payout-types";

const statuses = [
  { key: "awaiting_transfer", label: "À verser" },
  { key: "pending", label: "En cours" },
  { key: "sent", label: "Code envoyé" },
  { key: "failed", label: "Envoi échoué" },
] as const;

const formatRate = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 });

export default function AdminOverview({ requests, rate }: { requests: PayoutRequest[]; rate: number }) {
  const total = requests.length;

  return <div className="admin-overview">
    <div className="admin-metrics">
      <section className="admin-panel admin-metric">
        <BadgePercent size={22} aria-hidden="true"/>
        <div><h2>Taux de remise</h2><strong>{formatRate.format(rate)} %</strong></div>
      </section>
      <section className="admin-panel admin-metric">
        <Coins size={22} aria-hidden="true"/>
        <div><h2>Demandes de remise récentes</h2><strong>{total}</strong></div>
      </section>
    </div>
    <section className="admin-panel admin-chart" aria-labelledby="admin-chart-title">
      <div className="admin-panel-heading">
        <h2 id="admin-chart-title">Suivi des versements</h2>
        <p>Statut des 100 dernières demandes au maximum.</p>
      </div>
      {total === 0 ? <p>Aucune demande de remise enregistrée.</p> :
        <ul className="admin-chart-bars">
          {statuses.map(({ key, label }) => {
            const count = requests.filter(request => request.status === key).length;
            return <li key={key}>
              <span>{label}</span>
              <div className="admin-chart-track" aria-hidden="true">
                <div data-status={key} style={{ width: `${count / total * 100}%` }}/>
              </div>
              <strong>{count}</strong>
            </li>;
          })}
        </ul>}
    </section>
  </div>;
}
