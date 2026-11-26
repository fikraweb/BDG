ALTER TABLE `buyers` ADD `address` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `customer_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `customer_provider_id` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `customer_last_error` text;