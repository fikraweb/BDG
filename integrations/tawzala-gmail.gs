// TAWZALA Gmail relay v2: separate company and customer confirmations.
// The private installation file preserves the current setup key.
var TAWZALA_SETUP_SECRET = "REPLACE_WITH_PRIVATE_SETUP_KEY";
var TAWZALA_RECIPIENTS = { remise: "remise@example.com", furniture: "commandes@example.com" };
function initialiserTawzala() {
  if (!/^[a-f0-9]{64}$/.test(TAWZALA_SETUP_SECRET)) throw new Error("Utilisez le fichier privé de configuration fourni pour TAWZALA.");
  var properties = PropertiesService.getScriptProperties(), previous = properties.getProperty("TAWZALA_RELAY_SECRET");
  if (previous && previous !== TAWZALA_SETUP_SECRET) throw new Error("Une autre clé est déjà configurée. Ne la remplacez pas.");
  var quota = MailApp.getRemainingDailyQuota();
  properties.setProperty("TAWZALA_RELAY_SECRET", TAWZALA_SETUP_SECRET);
  console.log("TAWZALA prêt. Quota d'envoi disponible : " + quota + ". Déployez la nouvelle version de l’application Web.");
}
function tawzalaJson_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return tawzalaJson_({ service: "TAWZALA Gmail", version: 2, recipientRevision: 2, recipients: TAWZALA_RECIPIENTS, customerConfirmation: true, registrationNotification: true, ready: !!PropertiesService.getScriptProperties().getProperty("TAWZALA_RELAY_SECRET") }); }
function tawzalaEqual_(a, b) {
  var difference = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
function tawzalaEmail_(value) { return typeof value === "string" && value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value); }
function tawzalaMessage_(value, id) { return value && typeof value.subject === "string" && value.subject.length <= 300 && !/[\r\n]/.test(value.subject) && value.subject.endsWith(id) && typeof value.body === "string" && value.body.length <= 150000; }
function tawzalaDeliver_(properties, propertyName, id, message) {
  var previous = properties.getProperty(propertyName);
  if (previous) {
    var record = JSON.parse(previous);
    if (record.status === "sent") return { status: "sent", id: id, duplicate: true };
    return { status: "failed", code: "delivery_unknown" };
  }
  if (MailApp.getRemainingDailyQuota() < 1) return { status: "failed", code: "daily_quota" };
  properties.setProperty(propertyName, JSON.stringify({ status: "pending", timestamp: Date.now() }));
  try {
    MailApp.sendEmail(message);
    properties.setProperty(propertyName, JSON.stringify({ status: "sent", timestamp: Date.now() }));
    return { status: "sent", id: id };
  } catch (_) {
    // Preserve uncertainty: Gmail may have received the message already.
    return { status: "failed", code: "delivery_unknown" };
  }
}
function doPost(e) {
  var lock = null, acquired = false;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== "string" || raw.length > 6500000) return tawzalaJson_({ ok: false, code: "invalid_request" });
    var envelope = JSON.parse(raw), properties = PropertiesService.getScriptProperties(), secret = properties.getProperty("TAWZALA_RELAY_SECRET");
    if (!secret) return tawzalaJson_({ ok: false, code: "not_configured" });
    if (envelope.version !== 1 || !Number.isSafeInteger(envelope.timestamp) || Math.abs(Date.now() - envelope.timestamp) > 300000 || typeof envelope.payload !== "string" || envelope.payload.length > 6100000 || typeof envelope.signature !== "string" || !/^[a-f0-9]{64}$/.test(envelope.signature)) return tawzalaJson_({ ok: false, code: "invalid_signature" });
    var expected = Utilities.computeHmacSha256Signature(envelope.timestamp + "." + envelope.payload, secret, Utilities.Charset.UTF_8).map(function (byte) { return (byte & 255).toString(16).padStart(2, "0"); }).join("");
    if (!tawzalaEqual_(expected, envelope.signature)) return tawzalaJson_({ ok: false, code: "invalid_signature" });
    var order = JSON.parse(envelope.payload);
    if (order.kind === "registration") {
      if (order.to !== TAWZALA_RECIPIENTS.remise || typeof order.orderId !== "string" || !/^TZ-I-[A-F0-9]{12}$/.test(order.orderId) || !tawzalaEmail_(order.replyTo) || !tawzalaMessage_(order, order.orderId) || order.pdf || order.confirmation) return tawzalaJson_({ ok:false, code:"invalid_order" });
      lock = LockService.getScriptLock();
      if (!lock.tryLock(5000)) return tawzalaJson_({ok:false,code:"busy"});
      acquired = true;
      var registration = tawzalaDeliver_(properties, "REGISTRATION_" + order.orderId, "gmail:" + order.orderId, {to:TAWZALA_RECIPIENTS.remise,replyTo:order.replyTo,name:"Société TAWZALA SARL",subject:order.subject,body:order.body});
      return tawzalaJson_({ok:registration.status === "sent",id:registration.id || null,code:registration.code || null});
    }
    var recipient = TAWZALA_RECIPIENTS[order.kind];
    if (!recipient || order.to !== recipient || typeof order.orderId !== "string" || !/^TZ-[RM]-[A-F0-9]{12}$/.test(order.orderId) || (order.kind === "remise" ? !order.orderId.startsWith("TZ-R-") : !order.orderId.startsWith("TZ-M-"))) return tawzalaJson_({ ok: false, code: "invalid_order" });
    if (!tawzalaEmail_(order.replyTo) || !tawzalaMessage_(order, order.orderId)) return tawzalaJson_({ ok: false, code: "invalid_order" });
    if (order.confirmation !== undefined && (!tawzalaMessage_(order.confirmation, order.orderId) || !tawzalaEmail_(order.confirmation.to) || order.confirmation.to !== order.replyTo)) return tawzalaJson_({ ok: false, code: "invalid_confirmation" });
    if (!order.pdf || order.pdf.filename !== order.orderId + ".pdf" || typeof order.pdf.content !== "string" || order.pdf.content.length > 5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(order.pdf.content)) return tawzalaJson_({ ok: false, code: "invalid_pdf" });
    var pdfBytes = Utilities.base64Decode(order.pdf.content);
    if (pdfBytes.length < 8 || pdfBytes.length > 4194304 || pdfBytes[0] !== 37 || pdfBytes[1] !== 80 || pdfBytes[2] !== 68 || pdfBytes[3] !== 70 || pdfBytes[4] !== 45) return tawzalaJson_({ ok: false, code: "invalid_pdf" });
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return tawzalaJson_({ ok: false, code: "busy" });
    acquired = true;
    var cutoff = Date.now() - 7 * 86400000, all = properties.getProperties();
    Object.keys(all).forEach(function (key) {
      if (!key.startsWith("ORDER_")) return;
      try { if (JSON.parse(all[key]).timestamp < cutoff) properties.deleteProperty(key); } catch (_) { /* Preserve uncertain records. */ }
    });
    var attachment = Utilities.newBlob(pdfBytes, "application/pdf", order.pdf.filename);
    var company = tawzalaDeliver_(properties, "ORDER_" + order.orderId, "gmail:" + order.orderId, { to: recipient, replyTo: order.replyTo, name: BRAND_NAME, subject: order.subject, body: order.body, attachments: [attachment] });
    var customer = { status: "not_requested" };
    if (order.confirmation) customer = tawzalaDeliver_(properties, "ORDER_" + order.orderId + "_customer", "gmail:" + order.orderId + ":customer", { to: order.confirmation.to, replyTo: recipient, name: BRAND_NAME, subject: order.confirmation.subject, body: order.confirmation.body, attachments: [attachment] });
    return tawzalaJson_({ version: 2, ok: company.status === "sent", id: company.id || null, company: company, customer: customer });
  } catch (_) { return tawzalaJson_({ ok: false, code: "relay_error" }); }
  finally { if (lock && acquired) lock.releaseLock(); }
}
