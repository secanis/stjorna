export type Role = 'viewer' | 'editor' | 'admin';

export interface UserTenant {
  id: string;
  tenant: string;
  tenantName?: string;
  role: Role;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  custom_domain: string;
  theme_config: string;
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