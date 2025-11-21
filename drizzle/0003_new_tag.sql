CREATE TABLE `toxicity_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prescriptionId` int NOT NULL,
	`userId` int NOT NULL,
	`toxicityType` varchar(100) NOT NULL,
	`toxicityGrade` int NOT NULL,
	`doseAdjustment` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `toxicity_alerts_id` PRIMARY KEY(`id`)
);
