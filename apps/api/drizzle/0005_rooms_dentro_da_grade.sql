ALTER TABLE "rooms" ADD CONSTRAINT "rooms_largura_range" CHECK ("rooms"."largura" BETWEEN 1 AND 4);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_altura_range" CHECK ("rooms"."altura" BETWEEN 1 AND 2);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_x_range" CHECK ("rooms"."x" BETWEEN 0 AND 5);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_y_min" CHECK ("rooms"."y" >= 0);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_dentro_da_grade" CHECK ("rooms"."x" + "rooms"."largura" <= 6);