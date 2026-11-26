CREATE TABLE `buyer_service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_buyer_service_requests_created` ON `buyer_service_requests` (`created_at`);