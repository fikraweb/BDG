import Portal from "@/app/portal";
import { readSettings } from "@/lib/site-store";
import { isDocumentKind } from "@/lib/document-types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<{ mode?: string | string[]; type?: string | string[] }> }) {
  const { path = [] } = await params;
  const pages: Record<string, string> = { "": "access", inscription: "register", "marches-publics": "hub", remise: "remise", demandes: "requests" };
  const screen = pages[path.join("/")];
  if (!screen) notFound();
  const { mode, type } = await searchParams;
  return <Portal initialSettings={await readSettings()} initialScreen={screen} initialDocumentKind={isDocumentKind(type)?type:null} initialAccountMode={mode === "connexion" ? "signin" : "signup"} />;
}
