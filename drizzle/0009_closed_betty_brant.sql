CREATE TABLE `__new_document_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text,
	`kind` text NOT NULL,
	`details` text NOT NULL,
	`draft` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`ack_company_status` text DEFAULT 'pending_configuration' NOT NULL,
	`ack_customer_status` text DEFAULT 'pending_configuration' NOT NULL,
	`ack_claim` text,
	`send_status` text DEFAULT 'not_sent' NOT NULL,
	`send_event` text,
	`send_claim` text,
	`company_delivery` text,
	`customer_delivery` text,
	`company_error` text,
	`customer_error` text,
	`issued` text,
	`pdf_key` text,
	`document_number` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_document_requests`("id", "buyer_id", "kind", "details", "draft", "revision", "ack_company_status", "ack_customer_status", "ack_claim", "send_status", "send_event", "send_claim", "company_delivery", "customer_delivery", "company_error", "customer_error", "issued", "pdf_key", "document_number", "created_at", "updated_at") SELECT "id", "buyer_id", "kind", "details", "draft", "revision", "ack_company_status", "ack_customer_status", "ack_claim", "send_status", "send_event", "send_claim", "company_delivery", "customer_delivery", NULL, NULL, "issued", "pdf_key", "document_number", "created_at", "updated_at" FROM `document_requests`;--> statement-breakpoint
DROP TABLE `document_requests`;--> statement-breakpoint
ALTER TABLE `__new_document_requests` RENAME TO `document_requests`;--> statement-breakpoint
CREATE INDEX `idx_document_requests_buyer_created` ON `document_requests` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_document_requests_created` ON `document_requests` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_requests_number` ON `document_requests` (`kind`,`document_number`);
