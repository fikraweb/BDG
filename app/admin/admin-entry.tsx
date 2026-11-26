"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import Admin from "@/app/admin/admin";
import { enterAdminVisit, finishClientPage, endClientVisit, isReload, isInternalVisitExit, prepareBuyerReturn } from "@/lib/client-visit";

type AdminSession = { email: string; token: string };
const ADMIN_VISIT = "bdg:admin-visit";

type LoginReply = { error?: string; email: string; sessionToken: string };
export default function AdminEntry() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const current = useRef<AdminSession | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [visible, setVisible] = useState(false);
  function remember(value: AdminSession | null) {
    current.current = value;
    setSession(value);
    try {
      if (value) sessionStorage.setItem(ADMIN_VISIT, JSON.stringify(value));
      else sessionStorage.removeItem(ADMIN_VISIT);
    } catch { /* Keep the current in-memory session. */ }
  }
  function revoke(value: AdminSession) {
    return fetch("/api/admin/auth", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + value.token }, body: JSON.stringify({ action: "logout" }) });
  }
  useEffect(() => {
    enterAdminVisit();
    const controller = new AbortController();
    async function resume() {
      let saved: AdminSession | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(ADMIN_VISIT) ?? "null"); } catch { return; }
      if (!saved || !/^[a-f0-9]{64}$/.test(saved.token)) return;
      if (!isReload()) {
        remember(null);
        void revoke(saved).catch(() => {});
        return;
      }
      setBusy(true);
      try {
        const response = await fetch("/api/admin/auth", {
          cache: "no-store",
          headers: { Authorization: "Bearer " + saved.token },
          signal: controller.signal,
        });
        const data = await response.json() as { authenticated: boolean; email: string };
        if (!controller.signal.aborted) remember(response.ok && data.authenticated ? { email: data.email, token: saved.token } : null);
      } catch {
        if (!controller.signal.aborted) setError("Impossible de vérifier votre session. Réessayez.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void resume();
    function leave() {
      controller.abort();
      flushSync(() => setSession(null));
      if (!isInternalVisitExit()) finishClientPage();
    }
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return;
      const value = current.current;
      remember(null);
      setBusy(false);
      if (value) void revoke(value).catch(() => {});
      void endClientVisit().catch(() => {});
    }
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      controller.abort();
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
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
  return <main className="admin-access bdg-themed"><div className="admin-login-card"><img className="brand-logo" src="/images/bdg-logo.webp" alt="BDG" width={44} height={44}/><h1>Espace admin</h1><p>Saisissez votre email et votre mot de passe pour accéder à l’administration.</p><form className="access-form" onSubmit={signIn}><label className="field">Email administrateur<div className="input-wrap"><span className="input-icon"><Mail size={18} aria-hidden="true"/></span><input name="email" type="email" required maxLength={254} autoComplete="username"/></div></label><label className="field">Mot de passe<div className="input-wrap"><span className="input-icon"><LockKeyhole size={18} aria-hidden="true"/></span><input name="password" type={visible ? "text" : "password"} required  maxLength={128} autoComplete="current-password"/><button type="button" className="show-password" onClick={() => setVisible(!visible)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={18}/> : <LockKeyhole size={18}/>} Se connecter</button></form><a className="admin-return" href="/">Retour au site</a></div></main>;
}
