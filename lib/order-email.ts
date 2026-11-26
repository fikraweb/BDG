import { procurementLabel } from "@/lib/procurement";
import { COMPANY, type Company } from "@/lib/company";
import { money, type Buyer } from "@/lib/catalog";

export function orderEmails(orderId: string, buyer: Buyer, kind: "remise" | "furniture", details: Record<string, unknown>, _total: number, createdAt: number) {
  const company = (details.company || COMPANY) as Company;
  const companyName = company.name.replace(/[\r\n]/g, " ");
  const type = kind === "remise" ? "remise d’achat" : "mobilier";
  const contactEmail = String(details.email || buyer.email);
  const date = new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(createdAt);
  const information = [
    "Référence de la demande : " + orderId,
    "N° / référence du devis : " + String(details.devisReference || ""),
    "Date : " + date,
    "Cadre d’achat : " + procurementLabel(details.procurementType),
    "Objet de la prestation : " + String(details.objet || ""),
    "", "Coordonnées du client",
    "Nom et prénom : " + buyer.name,
    "Maître d’ouvrage : " + String(details.maitreOuvrage || buyer.maitreOuvrage || ""),
    "Téléphone : " + String(details.phone || buyer.phone),
    "Email : " + contactEmail,
    "Ville : " + String(details.clientCity || buyer.city || "Non renseignée"),
  ].join("\n");
  const attachment = "L’ensemble des informations et le détail de la demande figurent dans le document PDF joint à cet email.";
  const signature = "Cordialement,\nService clients\n" + companyName;
  const payout = kind === "remise" ? details.payout as { orderId: string; providerName: string; code: string; amount: number } | undefined : undefined;
  if (payout) {
    const transfer = [
      "Référence de votre demande : " + payout.orderId,
      "Service de retrait : " + payout.providerName,
      "Montant de la remise d’achat : " + money(payout.amount),
      "Code / numéro de transfert : " + payout.code,
      "", "Ce code est personnel. Présentez-le auprès du service de transfert avec les documents demandés par celui-ci.",
    ].join("\n");
    return {
      contactEmail,
      company: { subject: companyName + " · Code de transfert " + payout.providerName + " · " + orderId, body: "Le code de versement a été préparé pour " + buyer.name + ".\n\n" + transfer + "\n\n" + information + "\n\n" + attachment + "\n\n" + signature },
      customer: { subject: companyName + " · Votre code " + payout.providerName + " · " + orderId, body: "Bonjour " + buyer.name + ",\n\nVoici le code de transfert de votre remise d’achat.\n\n" + transfer + "\n\n" + information + "\n\n" + attachment + "\n\n" + signature },
    };
  }
  const deadline = kind === "remise" ? "\n\nLe versement de votre remise d’achat est prévu sous 24 heures. Votre code de transfert vous sera communiqué par email." : "";
  return {
    contactEmail,
    company: { subject: companyName + " · Nouvelle demande de " + type + " · " + orderId, body: "Une nouvelle demande de " + type + " a été enregistrée.\n\n" + information + "\n\n" + attachment + "\n\n" + signature },
    customer: { subject: companyName + " · Confirmation de votre demande de " + type + " · " + orderId, body: "Bonjour " + buyer.name + ",\n\nNous vous confirmons l’enregistrement de votre demande de " + type + ".\n\n" + information + "\n\n" + attachment + deadline + "\n\n" + signature },
  };
}
