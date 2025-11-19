CREATE TABLE `institution_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`institutionName` varchar(255),
	`institutionLogo` text,
	`prescriberName` varchar(255),
	`prescriberCRM` varchar(64),
	`prescriberSpecialty` varchar(255),
	`headerTemplate` text,
	`footerTemplate` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `institution_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`age` int NOT NULL,
	`sex` enum('M','F') NOT NULL,
	`weight` int NOT NULL,
	`height` int NOT NULL,
	`creatinine` int NOT NULL,
	`bilirubin` int NOT NULL,
	`ecog` int NOT NULL,
	`comorbidities` text,
	`cumulativeDoxorubicin` int DEFAULT 0,
	`cumulativeDaunorubicin` int DEFAULT 0,
	`cumulativeIdarubicin` int DEFAULT 0,
	`cumulativeEpirubicin` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prescriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prescriptionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`patientId` int NOT NULL,
	`patientName` varchar(255) NOT NULL,
	`protocolId` varchar(64) NOT NULL,
	`protocolName` varchar(255) NOT NULL,
	`cycle` int NOT NULL,
	`bsa` int NOT NULL,
	`egfr` int NOT NULL,
	`renalStatus` enum('green','yellow','red') NOT NULL,
	`drugs` json NOT NULL,
	`antiemetics` json NOT NULL,
	`prophylaxis` json NOT NULL,
	`alerts` json NOT NULL,
	`adjustmentFactor` int NOT NULL,
	`toxicityAdjustment` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prescriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `prescriptions_prescriptionId_unique` UNIQUE(`prescriptionId`)
);
--> statement-breakpoint
CREATE TABLE `protocol_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`protocolId` varchar(64) NOT NULL,
	`protocolName` varchar(255) NOT NULL,
	`indication` varchar(255),
	`usedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `protocol_usage_id` PRIMARY KEY(`id`)
);
