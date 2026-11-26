CREATE TABLE `remise_payouts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`provider` text NOT NULL,
	`recipient_email` text NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`claim_id` text NOT NULL,
	`company_status` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_remise_payout_event` ON `remise_payouts` (`event_id`);