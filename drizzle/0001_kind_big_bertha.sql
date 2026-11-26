CREATE TABLE `buyer_credentials` (
	`buyer_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_buyer_credentials_email` ON `buyer_credentials` (`email`);