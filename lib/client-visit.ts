"use client";

const CONTINUATION = "tawzala:internal-visit";
const VISIT = "tawzala:current-visit";
let initialization: Promise<void> | null = null;
let internalExit = false;
let adminEntered = false;
let buyerReturnAllowed = false;
let reloadExit = false;
type Continuation = { route: "/admin" | "/marches-publics"; expiresAt: number };
type Visit = { expiresAt: number; reloadPending: boolean };
function readVisit(): Visit | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(VISIT) || "null");
    return value && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}
function rememberVisit(reloadPending = false) {
  try { sessionStorage.setItem(VISIT, JSON.stringify({ expiresAt: readVisit()?.expiresAt || Date.now() + 86400000, reloadPending })); }
  catch { /* A fresh login is the fallback if tab storage is unavailable. */ }
}
function forgetVisit() { try { sessionStorage.removeItem(VISIT); } catch { /* No saved tab state. */ } }
function isReload() { return window.performance.getEntriesByType?.("navigation").some(entry => (entry as PerformanceNavigationTiming).type === "reload") || false; }
function browserNavigation() { return (window as Window & { navigation?: EventTarget }).navigation; }
export function observeVisitNavigation() {
  const navigation = browserNavigation();
  if (!navigation) return () => {};
  function changing(event: Event) {
    const value = event as Event & { navigationType?: string; destination?: { sameDocument?: boolean }; signal?: AbortSignal };
    if (value.destination?.sameDocument) return;
    reloadExit = value.navigationType === "reload";
    if (reloadExit) value.signal?.addEventListener("abort", () => { reloadExit = false; }, { once: true });
  }
  navigation.addEventListener("navigate", changing);
  return () => navigation.removeEventListener("navigate", changing);
}
function readContinuation(): Continuation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CONTINUATION) || "null");
    return value && ["/admin", "/marches-publics"].includes(value.route) && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}
function forgetContinuation() { try { sessionStorage.removeItem(CONTINUATION); } catch { /* A fresh login is the safe fallback. */ } }
async function resetServerVisit(action: "begin-visit" | "end-visit", keepalive = false) {
  const response = await fetch("/api/tawzala", { method: "POST", keepalive, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!response.ok) throw new Error("Impossible de préparer votre accès. Réessayez.");
}
export function initializeClientVisit() {
  if (!initialization) {
    const continuation = readContinuation();
    forgetContinuation();
    const returning = continuation?.route === "/marches-publics" && window.location.pathname === continuation.route;
    // Only a reload of this tab or an explicit admin return keeps the visit.
    // The marker contains no credentials; the server still validates its cookie.
    const reloading = isReload() && readVisit()?.reloadPending === true;
    initialization = (returning || reloading ? Promise.resolve() : resetServerVisit("begin-visit"))
      .then(() => rememberVisit())
      .catch(error => { forgetVisit(); initialization = null; throw error; });
  }
  return initialization;
}
export function prepareAdminVisit() {
  try { sessionStorage.setItem(CONTINUATION, JSON.stringify({ route: "/admin", expiresAt: Date.now() + 120000 })); internalExit = true; initialization = null; }
  catch { internalExit = false; }
}
export function enterAdminVisit() {
  if (adminEntered) return; adminEntered = true;
  const continuation = readContinuation();
  forgetContinuation();
  buyerReturnAllowed = continuation?.route === "/admin" || (isReload() && readVisit()?.reloadPending === true);
  if (buyerReturnAllowed) rememberVisit(); else forgetVisit();
}
export function prepareBuyerReturn() {
  if (buyerReturnAllowed) {
    try { sessionStorage.setItem(CONTINUATION, JSON.stringify({ route: "/marches-publics", expiresAt: Date.now() + 120000 })); internalExit = true; initialization = null; }
    catch { internalExit = false; }
  }
}
export function isInternalVisitExit() { const result = internalExit; internalExit = false; return result; }
export function forgetClientContinuation() { forgetContinuation(); }
export function endClientVisit() {
  forgetContinuation(); forgetVisit(); initialization = null; internalExit = false; reloadExit = false; buyerReturnAllowed = false;
  // Keepalive is best effort on close; the next load also invalidates the
  // previous cookie before loading any customer data.
  return resetServerVisit("end-visit", true);
}
export function finishClientPage() {
  if (reloadExit || !browserNavigation()) {
    // Older browsers cannot distinguish an outgoing reload from a close.
    // Their next load must also be a reload of this same tab to resume.
    forgetContinuation(); rememberVisit(true); initialization = null; internalExit = false; reloadExit = false;
    return Promise.resolve();
  }
  return endClientVisit();
}
