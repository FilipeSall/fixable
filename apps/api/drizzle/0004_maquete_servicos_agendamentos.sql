CREATE TYPE "public"."service_status" AS ENUM('prioridade', 'atencao', 'execucao', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('confirmado', 'pendente', 'adiado');--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"status" "service_status" NOT NULL,
	"prazo" date,
	"percentual" integer DEFAULT 0 NOT NULL,
	"concluded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_percentual_range" CHECK ("services"."percentual" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"servico" text NOT NULL,
	"data" date NOT NULL,
	"hora" time NOT NULL,
	"status" "appointment_status" DEFAULT 'pendente' NOT NULL,
	"descricao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_property_id_idx" ON "services" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "services_room_id_idx" ON "services" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "appointments_client_id_data_idx" ON "appointments" USING btree ("client_id","data");--> statement-breakpoint
DO $$
DECLARE
  r record;
  placed uuid[];
  cur_floor uuid := NULL;
  cx integer;
  cy integer;
  found boolean;
BEGIN
  FOR r IN SELECT id, floor_id, largura, altura FROM rooms ORDER BY floor_id, posicao, id LOOP
    IF cur_floor IS DISTINCT FROM r.floor_id THEN
      cur_floor := r.floor_id;
      placed := ARRAY[]::uuid[];
    END IF;
    cy := 0;
    found := false;
    WHILE NOT found LOOP
      cx := 0;
      WHILE cx + r.largura <= 6 AND NOT found LOOP
        IF NOT EXISTS (
          SELECT 1 FROM rooms o
          WHERE o.id = ANY(placed)
            AND cx < o.x + o.largura AND o.x < cx + r.largura
            AND cy < o.y + o.altura AND o.y < cy + r.altura
        ) THEN
          found := true;
        ELSE
          cx := cx + 1;
        END IF;
      END LOOP;
      IF NOT found THEN
        cy := cy + 1;
      END IF;
    END LOOP;
    UPDATE rooms SET x = cx, y = cy WHERE id = r.id;
    placed := placed || r.id;
  END LOOP;
END $$;
