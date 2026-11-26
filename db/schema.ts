import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const buyers = sqliteTable("buyers", { id: text("id").primaryKey(), name: text("name").notNull(), phone: text("phone").notNull(), email: text("email").notNull(), maitreOuvrage: text("maitre_ouvrage"), address: text("address"), city: text("city"), procurementType: text("procurement_type", { enum: ["bon_de_commande", "marches"] }), createdAt: integer("created_at").notNull() });
export const buyerCredentials = sqliteTable("buyer_credentials", {
  buyerId: text("buyer_id").primaryKey().references(() => buyers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("idx_buyer_credentials_email").on(t.email)]);
export const sessions = sqliteTable("sessions", { tokenHash: text("token_hash").primaryKey(), buyerId: text("buyer_id").references(() => buyers.id), expiresAt: integer("expires_at").notNull() });
export const loginAttempts = sqliteTable("login_attempts", { key: text("key").primaryKey(), count: integer("count").notNull(), windowStart: integer("window_start").notNull() });
export const carts = sqliteTable("carts", { buyerId: text("buyer_id").primaryKey().references(() => buyers.id), items: text("items").notNull(), updatedAt: integer("updated_at").notNull() });
export const orders = sqliteTable("orders", { id: text("id").primaryKey(), buyerId: text("buyer_id").notNull().references(() => buyers.id), kind: text("kind").notNull(), details: text("details").notNull(), totalCents: integer("total_cents").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: integer("created_at").notNull() }, t => [index("idx_orders_buyer_id").on(t.buyerId)]);
export const notifications = sqliteTable("notifications", { orderId: text("order_id").primaryKey().references(() => orders.id), status: text("status").notNull(), providerId: text("provider_id"), lastError: text("last_error"), customerStatus: text("customer_status").notNull().default("not_requested"), customerProviderId: text("customer_provider_id"), customerLastError: text("customer_last_error"), updatedAt: integer("updated_at").notNull() });
export const siteSettings = sqliteTable("site_settings", { id: text("id").primaryKey(), value: text("value").notNull(), revision: integer("revision").notNull().default(1), updatedAt: integer("updated_at").notNull() });
export const catalogueProducts = sqliteTable("catalogue_products", {
  id: text("id").primaryKey(), catalogue: text("catalogue").notNull(), name: text("name").notNull(), category: text("category").notNull(),
  priceCents: integer("price_cents").notNull(), image: text("image").notNull(), description: text("description").notNull(), details: text("details").notNull(),
  active: integer("active").notNull().default(1), demonstration: integer("demonstration").notNull().default(1), position: integer("position").notNull().default(0),
  revision: integer("revision").notNull().default(1), deletedAt: integer("deleted_at"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [index("idx_catalogue_products_listing").on(t.deletedAt, t.active, t.catalogue, t.position)]);
export const remisePayouts = sqliteTable("remise_payouts", {
  orderId:text("order_id").primaryKey().references(()=>orders.id),eventId:text("event_id").notNull(),provider:text("provider").notNull(),recipientEmail:text("recipient_email").notNull(),code:text("code").notNull(),status:text("status").notNull(),claimId:text("claim_id").notNull(),companyStatus:text("company_status"),lastError:text("last_error"),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),
},t=>[uniqueIndex("idx_remise_payout_event").on(t.eventId)]);

export const adminSessions = sqliteTable("admin_sessions",{tokenHash:text("token_hash").primaryKey(),expiresAt:integer("expires_at").notNull()});

export const documentRequests = sqliteTable("document_requests", {
  id: text("id").primaryKey(), buyerId: text("buyer_id").references(() => buyers.id), kind: text("kind").notNull(),
  details: text("details").notNull(), draft: text("draft").notNull(), revision: integer("revision").notNull().default(1),
  ackCompanyStatus: text("ack_company_status").notNull().default("pending_configuration"), ackCustomerStatus: text("ack_customer_status").notNull().default("pending_configuration"), ackClaim: text("ack_claim"),
  sendStatus: text("send_status").notNull().default("not_sent"), sendEvent: text("send_event"), sendClaim: text("send_claim"),
  companyDelivery: text("company_delivery"), customerDelivery: text("customer_delivery"), companyError: text("company_error"), customerError: text("customer_error"), issued: text("issued"), pdfKey: text("pdf_key"), documentNumber: text("document_number"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [index("idx_document_requests_buyer_created").on(t.buyerId, t.createdAt), index("idx_document_requests_created").on(t.createdAt), uniqueIndex("idx_document_requests_number").on(t.kind, t.documentNumber)]);
