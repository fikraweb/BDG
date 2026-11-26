export function emailDeliveryMessage(code?: string | null) {
  const messages: Record<string, string> = {
    daily_quota: "Le quota quotidien d’envoi du compte Gmail est atteint. Réessayez après son renouvellement.",
    busy: "Le service email traite un autre envoi. Réessayez dans un instant.",
    timeout: "La réponse du service email a pris trop de temps. Réessayez l’envoi du même document.",
    transport: "La connexion au service email a échoué. Réessayez l’envoi du même document.",
    provider_unavailable: "Le service email est temporairement indisponible. Réessayez dans un instant.",
    delivery_unknown: "Le service email n’a pas confirmé cet envoi. Vérifiez la boîte du destinataire avant de réessayer.",
    not_configured: "L’envoi des emails n’est pas configuré pour ce site. Vérifiez sa configuration privée.",
    requires_v2: "Le relais Gmail doit être mis à jour avec la version 2 fournie dans le dossier de publication.",
    invalid_signature: "Le relais Gmail a refusé la clé de configuration du site. Vérifiez la configuration privée de l’envoi.",
    invalid_order: "Le relais Gmail a refusé le message. Vérifiez que ses adresses de réception correspondent à celles du site.",
    invalid_confirmation: "Le relais Gmail a refusé l’adresse ou le message du destinataire.",
    invalid_pdf: "Le relais Gmail a refusé le PDF joint.",
    pdf_too_large: "Le PDF dépasse la taille acceptée par le relais email. Réduisez le nombre de photos ou d’articles.",
    relay_error: "Le relais Gmail a rencontré une erreur. Réessayez dans un instant.",
  };
  return messages[code || ""] || "Le service email n’a pas confirmé la remise du document au destinataire. Réessayez l’envoi du même document.";
}
