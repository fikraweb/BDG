"use client";
import {useId} from "react";
import {money, type FurnitureQuote} from "@/lib/catalog";

export default function FurnitureSummary({quote}:{quote:FurnitureQuote|null}) {
  const titleId=useId();
  if(!quote)return null;
  const count=quote.items.reduce((sum,item)=>sum+item.quantity,0);
  return <section className="furniture-summary" aria-labelledby={titleId}>
    <div className="furniture-summary-heading"><h3 id={titleId}>Votre sélection</h3><span>{count} article{count>1?"s":""}</span></div>
    <ul className="furniture-summary-items">{quote.items.map((item,index)=><li className="furniture-summary-item" key={index}>
      <img src={item.image} alt={item.name} width={88} height={88}/>
      <div className="furniture-summary-info"><h4>{item.name}</h4>
        {item.description&&<p>{item.description}</p>}
        {item.dimensions&&<p className="furniture-summary-size">Dimensions (L × P × H) : <strong>{item.dimensions.label}</strong></p>}
        {!!item.specifications.length&&<p className="furniture-summary-specs">{item.specifications.join(" · ")}</p>}
        <dl><div><dt>Quantité</dt><dd>{item.quantity}</dd></div><div><dt>Prix unitaire TTC</dt><dd>{money(item.price)}</dd></div><div><dt>Sous-total TTC</dt><dd>{money(Math.round(item.price*100)*item.quantity/100)}</dd></div></dl>
      </div>
    </li>)}</ul>
    <div className="furniture-order-total"><span>Total de la commande TTC</span><strong>{money(quote.amount)}</strong></div>
  </section>;
}
