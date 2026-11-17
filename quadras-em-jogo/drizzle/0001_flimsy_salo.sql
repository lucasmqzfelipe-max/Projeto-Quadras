CREATE TABLE `courts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`city` varchar(120) NOT NULL,
	`region` varchar(120) NOT NULL,
	`address` text NOT NULL,
	`sportType` varchar(80) NOT NULL,
	`description` text,
	`status` enum('open','closed','playing') NOT NULL DEFAULT 'open',
	`lastStatusUpdate` timestamp NOT NULL DEFAULT (now()),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `status_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courtId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('open','closed','playing') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `status_updates_id` PRIMARY KEY(`id`)
);
