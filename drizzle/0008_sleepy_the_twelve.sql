CREATE TABLE `document_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
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
	`issued` text,
	`pdf_key` text,
	`document_number` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_document_requests_buyer_created` ON `document_requests` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_document_requests_created` ON `document_requests` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_requests_number` ON `document_requests` (`kind`,`document_number`);