CREATE TABLE "http_allow_list_domains" (
    "id" SERIAL NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "http_allow_list_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "http_allow_list_domains_domain_key" ON "http_allow_list_domains"("domain");
CREATE INDEX "idx_http_allow_list_created_by" ON "http_allow_list_domains"("created_by");

ALTER TABLE "http_allow_list_domains"
ADD CONSTRAINT "http_allow_list_domains_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
