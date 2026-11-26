"use client";

import { useEffect, useState } from "react";
import { serviceRequests, type ServiceRequest } from "@/lib/buyer-services";

export default function ServiceRequestsPanel({ token }: { token: string }) {
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/services", {
          cache: "no-store",
          headers: { Authorization: "Bearer " + token },
          signal: controller.signal,
        });
        const data = await response.json() as { error?: string; requests: ServiceRequest[] };
        if (!response.ok) throw new Error(data.error);
        setRequests(data.requests);
      } catch (error) {
        if (!controller.signal.aborted) setError((error as Error).message || "Chargement impossible.");
      }
    }
    void load();
    return () => controller.abort();
  }, [token]);

  return <section className="admin-panel">
    <h2>Demandes de services</h2>
    {error ? <p className="form-error" role="alert">{error}</p> : requests === null ? <p>Chargement…</p> : requests.length === 0 ? <p>Aucune demande enregistrée.</p> :
      <div className="buyer-service-inbox">{requests.map(request => <article className="form-section" key={request.id}>
        <h3>{request.subject}</h3>
        <p>{serviceRequests[request.kind]} · {request.id}</p>
        <p>{request.name} · <a href={`mailto:${request.email}`}>{request.email}</a></p>
        <p className="buyer-service-message">{request.message}</p>
      </article>)}</div>}
  </section>;
}
