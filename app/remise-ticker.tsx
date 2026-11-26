"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

const examples = [
  { rate: 3, rising: false },
  { rate: 6, rising: true },
  { rate: 5, rising: true },
  { rate: 4, rising: false },
];
const rateFormat = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 });

export default function RemiseTicker({ rate }: { rate: number }) {
  const [paused, setPaused] = useState(false);

  return <section className="remise-ticker" aria-labelledby="remise-ticker-heading" data-paused={paused}>
    <div className="remise-ticker-header">
      <div className="remise-ticker-rate">
        <h2 id="remise-ticker-heading">Remise d’achat</h2>
        <strong>{rateFormat.format(rate)} %</strong>
        <span>Taux en vigueur · fixé par la société</span>
      </div>
      <button className="remise-ticker-toggle" type="button" onClick={() => setPaused(value => !value)}>
        {paused ? "Reprendre" : "Pause"}
      </button>
    </div>
    <div className="remise-ticker-window" aria-hidden="true">
      <div className="remise-ticker-track">
        {[0, 1].map(group => <div className="remise-ticker-group" key={group}>
          {examples.map(({ rate: example, rising }) => {
            const Trend = rising ? ArrowUpRight : ArrowDownRight;
            return <div key={example} className="remise-ticker-example" data-rising={rising}>
              <svg viewBox="0 0 76 28" width="76" height="28" fill="none">
                <polyline points={rising ? "1,25 13,19 24,22 36,12 48,16 61,8 75,3" : "1,3 13,9 24,5 36,17 48,13 61,22 75,26"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
              <div><strong><Trend size={17}/>{example} %</strong><small>Illustration</small></div>
            </div>;
          })}
        </div>)}
      </div>
    </div>
    <p>Les pourcentages animés sont des exemples. Le calcul utilise le taux en vigueur affiché ci-dessus.</p>
  </section>;
}
