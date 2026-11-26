export const serviceRequests = {
  caution: "Demande de caution",
  echanges: "Échanges entre maîtres d’ouvrage",
  autres: "Autres services",
} as const;

export type ServiceRequestKind = keyof typeof serviceRequests;

export function isServiceRequestKind(value: unknown): value is ServiceRequestKind {
  return typeof value === "string" && Object.hasOwn(serviceRequests, value);
}

export type ServiceRequest = {
  id: string;
  kind: ServiceRequestKind;
  subject: string;
  message: string;
  name: string;
  email: string;
  createdAt: number;
};

export const extraServices = {
  caution: serviceRequests.caution,
  references: "Références de la société",
  reglementation: "Réglementation des marchés publics",
  echanges: serviceRequests.echanges,
  autres: serviceRequests.autres,
} as const;

export type ExtraService = keyof typeof extraServices;

export function isExtraService(value: string): value is ExtraService {
  return Object.hasOwn(extraServices, value);
}
