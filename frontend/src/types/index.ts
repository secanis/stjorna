export type Role = 'viewer' | 'editor' | 'admin';

export interface UserTenant {
  id: string;
  tenant: string;
  tenantName?: string;
  role: Role;
  themeConfig?: TenantThemeConfig;
}

// Per-tenant theming. All keys optional; unknown keys are preserved
// by the settings editors so forward-compatible fields survive a save.
export interface TenantThemeConfig {
  // Media record ID used as the header logo (replaces the "STJÓRNA" text
  // in the top header of the content area; the sidebar stays untouched).
  logoMediaId?: string;
  // CSS color for the header background in light mode. Empty/unset = default.
  headerBgLight?: string;
  // CSS color for the header background in dark mode. Empty/unset = default.
  headerBgDark?: string;
  [key: string]: unknown;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  custom_domain: string;
  // JSON field. Normally an object; older records may hold a JSON-encoded
  // string, so always read it through utils/themeConfig.parseThemeConfig.
  theme_config: TenantThemeConfig | string | null;
  created: string;
  updated: string;
}

export interface Media {
  id: string;
  tenant: string;
  file: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number;
  height: number;
  createdUser: string;
  created: string;
  updated: string;
}

export interface Category {
  id: string;
  tenant: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  sort_order: number;
  // Single relation to a media record ('' when unset).
  media: string;
  created: string;
  updated: string;
}

export interface Product {
  id: string;
  tenant: string;
  category: string;
  name: string;
  slug: string;
  price: number;
  description: string;
  media: string[];
  active: boolean;
  sort_order: number;
  /** PocketBase JSON field: parsed object (or null) as returned by the SDK. */
  custom_fields: Record<string, unknown> | null;
  createdUser: string;
  updatedUser: string;
  created: string;
  updated: string;
}
// Singleton `instance_settings` record (superuser-only). Secret columns
// (s3_secret_key, s3_access_key, oidc_client_secret) were dropped; those
// values live in PocketBase's own encrypted settings.
export interface InstanceSettings {
  id: string;
  instance_name: string;
  instance_url: string;
  instance_logo_url: string;
  instance_tagline: string;
  setup_done: boolean;
  storage_type: string;
  s3_bucket: string;
  s3_region: string;
  s3_endpoint: string;
  s3_force_path_style: boolean;
  oidc_enabled: boolean;
  oidc_provider_name: string;
  oidc_display_name: string;
  oidc_client_id: string;
  oidc_auth_url: string;
  oidc_token_url: string;
  oidc_user_info_url: string;
  oidc_scopes: string;
  oidc_group_claim: string;
  oidc_group_separator: string;
  oidc_group_prefix: string;
  oidc_default_role: string;
  oidc_role_mapping: string;
  oidc_auto_create_tenants: boolean;
  oidc_deny_on_no_group: boolean;
  oidc_disable_password_login: boolean;
  oidc_sync_mode: '' | 'replace-oidc' | 'additive';
  oidc_allow_unverified_email: boolean;
  created: string;
  updated: string;
}

// API key as returned by GET /api/stjorna/api-keys. The plaintext key is
// only ever present in the issue response, never in a stored record.
export interface ApiKey {
  id: string;
  tenant: string;
  name: string;
  prefix: string;
  // JSON field.
  permissions: Record<string, unknown> | null;
  last_used: string | null;
  expires: string | null;
  revoked: boolean;
  created_by?: string;
  service_user_id?: string;
  service_user_email?: string;
  created: string;
  updated?: string;
}
