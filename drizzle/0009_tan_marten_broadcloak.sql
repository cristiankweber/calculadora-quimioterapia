ALTER TABLE `custom_protocols` ADD COLUMN IF NOT EXISTS `clinicalDocument` json;--> statement-breakpoint
ALTER TABLE `custom_protocols` ADD COLUMN IF NOT EXISTS `clinicalPackage` json;
