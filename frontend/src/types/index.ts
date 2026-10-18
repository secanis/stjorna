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
  s3_key: string;
  s3_url: string;
  thumbnail_url: string;
  usage_count: number;
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
  custom_fields: string;
  createdUser: string;
  updatedUser: string;
  created: string;
  updated: string;
}