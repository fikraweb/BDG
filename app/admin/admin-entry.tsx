"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import Admin from "@/app/admin/admin";
import { enterAdminVisit, finishClientPage, endClientVisit, observeVisitNavigation, isInternalVisitExit, prepareBuyerReturn } from "@/lib/client-visit";

type AdminSession = { email: string; token: string };
type LoginReply = { error?: string; email: string; sessionToken: string };
export default function AdminEntry() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const current = useRef<AdminSession | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [visible, setVisible] = useState(false);
  function remember(value: AdminSession | null) { current.current = value; setSession(value); }
  function revoke(value: AdminSession) {
    return fetch("/api/admin/auth", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + value.token }, body: JSON.stringify({ action: "logout" }) });
  }
  useEffect(() => {
    enterAdminVisit();
    const stopNavigation = observeVisitNavigation();
    // Each visit renders the login form immediately; there is no account-creation step.
    function leave() {
      const value = current.current;
      flushSync(() => remember(null));
      if (value) void revoke(value).catch(() => {});
      if (!isInternalVisitExit()) void finishClientPage().catch(() => {});
    }
    function restore(event: PageTransitionEvent) { if (event.persisted) { leave(); void endClientVisit().catch(() => {}); } }
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      stopNavigation();
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      const value = current.current;
      current.current = null;
      if (value) void revoke(value).catch(() => {});
    };
  }, []);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", ...values }) });
      const data = await response.json() as LoginReply;
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      if (!/^[a-f0-9]{64}$/.test(data.sessionToken)) throw new Error("Connexion impossible. Réessayez.");
      remember({ email: data.email, token: data.sessionToken });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function signOut() {
    const value=current.current;
    remember(null);
    if(value)await revoke(value).catch(()=>{});
    prepareBuyerReturn(); window.location.assign("/marches-publics");
  }

  if (session) return <><Admin email={session.email} token={session.token} onSessionChange={value => remember(value)} onSessionExpired={() => { remember(null); setError("Votre session a expiré. Connectez-vous à nouveau."); }}/><button className="admin-signout" onClick={signOut}>Déconnexion admin</button></>;
  return <main className="admin-access"><div className="admin-login-card"><span className="eyebrow">BDG</span><h1>Espace admin</h1><p>Saisissez votre email et votre mot de passe à chaque ouverture de l’administration.</p><form className="access-form" onSubmit={signIn}><label className="field">Email administrateur<div className="input-wrap"><Mail size={18}/><input name="email" type="email" required maxLength={254} autoComplete="username"/></div></label><label className="field">Mot de passe<div className="input-wrap"><LockKeyhole size={18}/><input name="password" type={visible ? "text" : "password"} required  maxLength={128} autoComplete="current-password"/><button type="button" className="show-password" onClick={() => setVisible(!visible)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={18}/> : <LockKeyhole size={18}/>} Se connecter</button></form><a className="admin-return" href="/">Retour au site</a></div></main>;
}
