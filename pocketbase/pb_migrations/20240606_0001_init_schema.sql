-- STJÓRNA Initial Schema Migration
-- Creates all core collections for multi-tenant SaaS CMS

-- ============================================
-- TENANTS (SaaS tenant management)
-- ============================================
CREATE TABLE "tenants" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "custom_domain" TEXT NOT NULL DEFAULT '',
    "theme_config" JSON NOT NULL DEFAULT '{}',
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "updated" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00'
);

CREATE UNIQUE INDEX idx_tenants_slug ON "tenants" ("slug");
CREATE INDEX idx_tenants_custom_domain ON "tenants" ("custom_domain");

-- ============================================
-- CATEGORIES (Product categories)
-- ============================================
CREATE TABLE "categories" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "active" NUMERIC NOT NULL DEFAULT 1,
    "sort_order" NUMERIC NOT NULL DEFAULT 0,
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "updated" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "createdUser" TEXT NOT NULL DEFAULT '',
    "updatedUser" TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_categories_tenant ON "categories" ("tenant");
CREATE INDEX idx_categories_active ON "categories" ("active");

-- ============================================
-- PRODUCTS (Products with dynamic fields)
-- ============================================
CREATE TABLE "products" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "price" REAL NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "images" JSON NOT NULL DEFAULT '[]',
    "active" NUMERIC NOT NULL DEFAULT 1,
    "sort_order" NUMERIC NOT NULL DEFAULT 0,
    "custom_fields" JSON NOT NULL DEFAULT '{}',
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "updated" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "createdUser" TEXT NOT NULL DEFAULT '',
    "updatedUser" TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_products_tenant ON "products" ("tenant");
CREATE INDEX idx_products_category ON "products" ("category");
CREATE INDEX idx_products_active ON "products" ("active");
CREATE INDEX idx_products_slug ON "products" ("slug");

-- ============================================
-- MEDIA (Central media library)
-- ============================================
CREATE TABLE "media" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "original_name" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL DEFAULT '',
    "size" NUMERIC NOT NULL DEFAULT 0,
    "width" NUMERIC NOT NULL DEFAULT 0,
    "height" NUMERIC NOT NULL DEFAULT 0,
    "s3_key" TEXT NOT NULL DEFAULT '',
    "s3_url" TEXT NOT NULL DEFAULT '',
    "thumbnail_url" TEXT NOT NULL DEFAULT '',
    "usage_count" NUMERIC NOT NULL DEFAULT 0,
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "createdUser" TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_media_tenant ON "media" ("tenant");

-- ============================================
-- PRODUCT_MEDIA (Junction table)
-- ============================================
CREATE TABLE "product_media" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL DEFAULT '',
    "media" TEXT NOT NULL DEFAULT '',
    "sort_order" NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX idx_product_media_tenant ON "product_media" ("tenant");
CREATE INDEX idx_product_media_product ON "product_media" ("product");
CREATE INDEX idx_product_media_media ON "product_media" ("media");

-- ============================================
-- EMBED_CONFIGS (Embed widget configurations)
-- ============================================
CREATE TABLE "embed_configs" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "embed_code" TEXT NOT NULL DEFAULT '',
    "allowed_domains" JSON NOT NULL DEFAULT '[]',
    "active" NUMERIC NOT NULL DEFAULT 1,
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "updated" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00'
);

CREATE INDEX idx_embed_configs_tenant ON "embed_configs" ("tenant");
CREATE INDEX idx_embed_configs_active ON "embed_configs" ("active");

-- ============================================
-- ANALYTICS_EVENTS (Usage tracking per domain)
-- ============================================
CREATE TABLE "analytics_events" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "media" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL DEFAULT '',
    "embed_config" TEXT NOT NULL DEFAULT '',
    "domain" TEXT NOT NULL DEFAULT '',
    "referer" TEXT NOT NULL DEFAULT '',
    "client_ip" TEXT NOT NULL DEFAULT '',
    "user_agent" TEXT NOT NULL DEFAULT '',
    "timestamp" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00'
);

CREATE INDEX idx_analytics_events_tenant ON "analytics_events" ("tenant");
CREATE INDEX idx_analytics_events_media ON "analytics_events" ("media");
CREATE INDEX idx_analytics_events_domain ON "analytics_events" ("domain");
CREATE INDEX idx_analytics_events_timestamp ON "analytics_events" ("timestamp");

-- ============================================
-- WEBHOOKS (Event subscriptions)
-- ============================================
CREATE TABLE "webhooks" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "events" JSON NOT NULL DEFAULT '[]',
    "secret" TEXT NOT NULL DEFAULT '',
    "active" NUMERIC NOT NULL DEFAULT 1,
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "updated" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00'
);

CREATE INDEX idx_webhooks_tenant ON "webhooks" ("tenant");
CREATE INDEX idx_webhooks_active ON "webhooks" ("active");

-- ============================================
-- API_KEYS (Read/write API keys)
-- ============================================
CREATE TABLE "api_keys" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "key_hash" TEXT NOT NULL DEFAULT '',
    "permissions" JSON NOT NULL DEFAULT '[]',
    "last_used" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "expires" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00'
);

CREATE INDEX idx_api_keys_tenant ON "api_keys" ("tenant");
CREATE INDEX idx_api_keys_key_hash ON "api_keys" ("key_hash");

-- ============================================
-- SETTINGS (Tenant-specific settings)
-- ============================================
CREATE TABLE "settings" (
    "id" TEXT PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT '',
    "config_json" JSON NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX idx_settings_tenant ON "settings" ("tenant");

-- ============================================
-- USER_PROFILES (Extends built-in users with tenant & role)
-- ============================================
CREATE TABLE "user_profiles" (
    "id" TEXT PRIMARY KEY,
    "user" TEXT NOT NULL DEFAULT '',
    "tenant" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'editor',
    "language" TEXT NOT NULL DEFAULT 'en',
    "avatar" TEXT NOT NULL DEFAULT '',
    "created" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00',
    "updated" DATETIME NOT NULL DEFAULT '0001-01-01 00:00:00'
);

CREATE UNIQUE INDEX idx_user_profiles_user ON "user_profiles" ("user");
CREATE INDEX idx_user_profiles_tenant ON "user_profiles" ("tenant");