CREATE TABLE `catalogue_products` (
	`id` text PRIMARY KEY NOT NULL,
	`catalogue` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price_cents` integer NOT NULL,
	`image` text NOT NULL,
	`description` text NOT NULL,
	`details` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`demonstration` integer DEFAULT 1 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalogue_products_listing` ON `catalogue_products` (`deleted_at`,`active`,`catalogue`,`position`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
