CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"address" text NOT NULL,
	"unit_type" text NOT NULL,
	"furnished" boolean DEFAULT true NOT NULL,
	"available_from" date NOT NULL,
	"available_to" date NOT NULL,
	"price_per_month" integer NOT NULL,
	"utilities_included" text NOT NULL,
	"broker_fee" boolean DEFAULT false NOT NULL,
	"security_deposit" integer DEFAULT 0 NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"landlord_name" text NOT NULL,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"submission_token" text NOT NULL,
	"approval_token" text NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"geom" geometry(Point, 4326),
	"nearest_station_id" integer,
	"walk_time_seconds" integer,
	"route_geo_json" jsonb,
	"nta_id" integer,
	"safety_score" double precision,
	"safety_tier" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "listings_submission_token_unique" UNIQUE("submission_token"),
	CONSTRAINT "listings_approval_token_unique" UNIQUE("approval_token")
);
--> statement-breakpoint
CREATE TABLE "nta_polygons" (
	"id" serial PRIMARY KEY NOT NULL,
	"nta_code" text NOT NULL,
	"nta_name" text NOT NULL,
	"borough" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	CONSTRAINT "nta_polygons_nta_code_unique" UNIQUE("nta_code")
);
--> statement-breakpoint
CREATE TABLE "nta_safety_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nta_id" integer NOT NULL,
	"incident_count" integer NOT NULL,
	"incidents_per_sqkm" double precision NOT NULL,
	"tier" text NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nta_safety_scores_nta_id_unique" UNIQUE("nta_id")
);
--> statement-breakpoint
CREATE TABLE "subway_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"name" text NOT NULL,
	"lines" text[] DEFAULT '{}'::text[] NOT NULL,
	"ada" boolean DEFAULT false NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"borough" text NOT NULL,
	"complex_id" integer,
	CONSTRAINT "subway_stations_station_id_unique" UNIQUE("station_id")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_nearest_station_id_subway_stations_id_fk" FOREIGN KEY ("nearest_station_id") REFERENCES "public"."subway_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_nta_id_nta_polygons_id_fk" FOREIGN KEY ("nta_id") REFERENCES "public"."nta_polygons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nta_safety_scores" ADD CONSTRAINT "nta_safety_scores_nta_id_nta_polygons_id_fk" FOREIGN KEY ("nta_id") REFERENCES "public"."nta_polygons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price_per_month");--> statement-breakpoint
CREATE INDEX "listings_geom_idx" ON "listings" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "nta_polygons_geom_idx" ON "nta_polygons" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "subway_stations_geom_idx" ON "subway_stations" USING gist ("geom");