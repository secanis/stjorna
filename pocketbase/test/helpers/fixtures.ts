let counter = 0;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') +
    '-' +
    generateId();
}

export interface TenantFixture {
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
}

export interface CategoryFixture {
  tenant: string;
  name: string;
  slug: string;
  description?: string;
  active?: boolean;
  sort_order?: number;
}

export interface ProductFixture {
  tenant: string;
  name: string;
  slug: string;
  category?: string;
  price?: number;
  description?: string;
  active?: boolean;
  sort_order?: number;
  custom_fields?: Record<string, unknown>;
}

export interface MediaFixture {
  tenant: string;
  filename: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
  width?: number;
  height?: number;
  s3_key?: string;
  s3_url?: string;
}

export interface WebhookFixture {
  tenant: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

export interface ApiKeyFixture {
  tenant: string;
  name: string;
  key_hash: string;
  permissions?: string[];
}

counter = Date.now();

export function createTenantFixture(overrides?: Partial<TenantFixture>): TenantFixture {
  const id = generateId();
  return {
    name: `Test Tenant ${id}`,
    slug: generateSlug(`Test Tenant ${id}`),
    plan: 'free',
    ...overrides,
  };
}

export function createCategoryFixture(tenantId: string, overrides?: Partial<CategoryFixture>): CategoryFixture {
  const id = generateId();
  return {
    tenant: tenantId,
    name: `Test Category ${id}`,
    slug: generateSlug(`Test Category ${id}`),
    description: '',
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

export function createProductFixture(tenantId: string, overrides?: Partial<ProductFixture>): ProductFixture {
  const id = generateId();
  return {
    tenant: tenantId,
    name: `Test Product ${id}`,
    slug: generateSlug(`Test Product ${id}`),
    category: '',
    price: Math.floor(Math.random() * 10000) / 100,
    description: '',
    active: true,
    sort_order: 0,
    custom_fields: {},
    ...overrides,
  };
}

export function createMediaFixture(tenantId: string, overrides?: Partial<MediaFixture>): MediaFixture {
  const id = generateId();
  return {
    tenant: tenantId,
    filename: `test-image-${id}.jpg`,
    original_name: `Test Image ${id}.jpg`,
    mime_type: 'image/jpeg',
    size: Math.floor(Math.random() * 10000000),
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

export function createWebhookFixture(tenantId: string, overrides?: Partial<WebhookFixture>): WebhookFixture {
  const id = generateId();
  return {
    tenant: tenantId,
    name: `Test Webhook ${id}`,
    url: `https://webhook.test/${id}`,
    events: ['category.created', 'product.created'],
    secret: '',
    active: true,
    ...overrides,
  };
}

export function createApiKeyFixture(tenantId: string, overrides?: Partial<ApiKeyFixture>): ApiKeyFixture {
  const id = generateId();
  return {
    tenant: tenantId,
    name: `Test API Key ${id}`,
    key_hash: generateId() + generateId(),
    permissions: ['read'],
    ...overrides,
  };
}

export function createUniqueEmail(): string {
  return `test-${generateId()}-${counter++}@stjorna.test`;
}