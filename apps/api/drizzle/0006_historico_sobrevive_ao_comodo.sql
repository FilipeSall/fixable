ALTER TABLE "services" DROP CONSTRAINT "services_room_id_rooms_id_fk";
--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "room_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;