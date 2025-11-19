ALTER TABLE `prescriptions` MODIFY COLUMN `renalStatus` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `prescriptionData` json NOT NULL;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `protocolId`;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `drugs`;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `antiemetics`;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `prophylaxis`;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `alerts`;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `adjustmentFactor`;--> statement-breakpoint
ALTER TABLE `prescriptions` DROP COLUMN `toxicityAdjustment`;