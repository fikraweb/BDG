import Portal from "@/app/portal";
import { readSettings } from "@/lib/site-store";
import { isBuyerDocumentKind } from "@/lib/document-types";
import { isExtraService } from "@/lib/buyer-services";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<{ mode?: string | string[]; type?: string | string[] }> }) {
  const { path = [] } = await params;
  const pages: Record<string, string> = { "": "access", inscription: "register", "marches-publics": "hub", remise: "remise", demandes: "requests" };
  const screen = path.length === 2 && path[0] === "services" && isExtraService(path[1]) ? path[1] : pages[path.join("/")];
  if (!screen) notFound();
  const { mode, type } = await searchParams;
  return <Portal initialSettings={await readSettings()} initialScreen={screen} initialDocumentKind={isBuyerDocumentKind(type)?type:null} initialAccountMode={mode === "connexion" ? "signin" : "signup"} />;
}
