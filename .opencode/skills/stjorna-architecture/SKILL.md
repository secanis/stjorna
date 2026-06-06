---
name: stjorna-architecture
description: Provides architecture guidance for STJÓRNA product management application rewrites. Use when discussing STJÓRNA redesign, PocketBase migration, SolidJS frontend, or Helm/Kubernetes deployment for STJÓRNA.
---

# STJÓRNA Architecture Skill

## Overview

STJÓRNA is a product/service management application with a public REST API for third-party access. The name means "manage" or "store stuff" in Icelandic.

### Core Features
- Product, Category, and Service management with image uploads
- Public read-only REST API for websites/third-party apps
- Export data as JSON/Excel or full backup as ZIP
- Multi-language support (German/English)
- Optional Matomo tracking integration
- Easy setup and configuration

### Current Architecture (Legacy)
- **Backend:** Node.js + Express + lowdb (JSON file-based)
- **Frontend:** Angular 12 + Bootstrap
- **Database:** lowdb (JSON files on filesystem)
- **Image Processing:** Jimp
- **Export:** archiver (ZIP), excel4node (Excel)

---

## Technology Stack for Rewrite

### Backend: PocketBase
- All-in-one solution with embedded SQLite database
- Built-in authentication system (JWT-based)
- REST API with SDKs for multiple languages
- Admin UI for data management
- Runs as a single binary
- Supports S3 file storage via external provider hook

**Why PocketBase?**
- Perfect fit for STJÓRNA's data model (products, categories, services, users)
- No separate database setup required
- Built-in auth eliminates custom JWT implementation
- Scales well for SaaS multi-tenant deployment
- S3 sync capability for backup/portability

**PocketBase Collections:**
1. `users` - Built-in auth collection (extends base user with role)
2. `categories` - Product categories
3. `products` - Products linked to categories
4. `services` - Services linked to categories
5. `settings` - Application configuration
6. `cronjobs` - Scheduled job state tracking

### Frontend: SolidJS + T3-inspired Stack
- SolidJS for reactive UI (no virtual DOM, fine-grained reactivity)
- @tanstack/solid-query for server state management
- @solidjs/router for routing
- TypeScript for type safety
- TailwindCSS for styling

**Why SolidJS?**
- Faster than React with less memory usage
- Smaller bundle size
- Native TypeScript support
- Great fit for SPA architecture

### Infrastructure
- Docker for containerization
- Helm Chart for Kubernetes deployment
- S3-compatible storage for file backup/sync

---

## Directory Structure

```
stjorna/
├── docker/
│   └── Dockerfile               # Multi-stage build for PocketBase
├── helm/
│   └── stjorna/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
├── pocketbase/
│   ├── pb_migrations/          # PocketBase migrations
│   └── pb_data/                # SQLite + uploaded files
├── client/                      # SolidJS frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route pages
│   │   ├── services/           # API and business logic
│   │   ├── stores/             # Client-side state
│   │   └── types/              # TypeScript interfaces
│   ├── index.html
│   └── package.json
├── s3-sync/                     # S3 backup synchronization
│   └── sync.ts
└── docker-compose.yml           # Local development stack
```

---

## Backend (PocketBase)

### Collection Schemas

#### Categories
```typescript
{
  id: string;           // Auto-generated
  name: string;
  description: string;
  image: string;        // File (single)
  active: boolean;
  created: number;      // Unix timestamp
  updated: number;
}
```

#### Products
```typescript
{
  id: string;
  name: string;
  category: string;     // Relation to Categories
  price: number;
  description: string;
  image: string;        // File (single)
  active: boolean;
  created: number;
  updated: number;
  createdUser: string;  // Relation to users
  updatedUser: string;  // Relation to users
}
```

#### Services
```typescript
{
  id: string;
  name: string;
  category: string;     // Relation to Categories
  price: number;
  description: string;
  image: string;        // File (single)
  active: boolean;
  created: number;
  updated: number;
  createdUser: string;
  updatedUser: string;
}
```

### API Rules

**Public API (read-only, requires API key):**
- `GET /api/collections/products/records?filter=active=true`
- `GET /api/collections/categories/records?filter=active=true`
- `GET /api/collections/services/records?filter=active=true`
- `GET /api/collections/products/records/:id`
- `GET /api/collections/categories/records/:id`
- `GET /api/collections/services/records/:id`

**Admin API (authenticated):**
- Full CRUD on all collections
- Settings management
- User management

### Authentication Flow
1. User submits username/password to `/api/collections/users/auth-with-password`
2. PocketBase returns JWT token + user record
3. Token included in `Authorization: Bearer <token>` header
4. For public API: Use API key in `X-API-Key` header

### Image Handling
- PocketBase handles file uploads natively
- Images stored in `pb_data/storage/`
- Thumbnails generated via PocketBase's built-in image transformation
- URL pattern: `/api/files/{collection}/{record_id}/{filename}?thumb=100x100`

### S3 Sync Implementation
```typescript
// s3-sync/sync.ts
import { PockBase } from 'pocketbase';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export class S3Sync {
  private pb: PocketBase;
  private s3: S3Client;
  private bucket: string;

  async backupDatabase() {
    // Export PocketBase data as JSON
    const exportData = {
      categories: await this.pb.collections.categories.getFullList(),
      products: await this.pb.collections.products.getFullList(),
      services: await this.pb.collections.services.getFullList(),
      settings: await this.pb.collections.settings.getFullList(),
      exportedAt: new Date().toISOString()
    };

    // Upload to S3
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: `backups/${Date.now()}/data.json`,
      Body: JSON.stringify(exportData)
    }));
  }

  async syncFiles() {
    // Sync uploaded files to S3
    const files = await this.listLocalFiles('pb_data/storage/');
    for (const file of files) {
      await this.uploadToS3(file);
    }
  }
}
```

---

## Frontend (SolidJS)

### Project Setup
```bash
npm create solid@latest client
# Select: TypeScript, SolidJS App

cd client
npm install @tanstack/solid-query @solidjs/router tailwindcss
```

### Key Components Structure

```
src/
├── components/
│   ├── ui/                     # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── product/
│   │   ├── ProductForm.tsx
│   │   ├── ProductList.tsx
│   │   └── ProductCard.tsx
│   ├── category/
│   │   ├── CategoryForm.tsx
│   │   └── CategoryList.tsx
│   ├── image/
│   │   └── ImageUpload.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Products.tsx
│   ├── Categories.tsx
│   ├── Services.tsx
│   ├── Settings.tsx
│   └── Setup.tsx
├── services/
│   ├── api.ts                  # PocketBase SDK wrapper
│   ├── auth.ts                 # Authentication service
│   └── export.ts               # Export functionality
├── stores/
│   └── auth.ts                 # Auth state management
├── types/
│   └── index.ts                # TypeScript interfaces
└── App.tsx
```

### API Integration
```typescript
// services/api.ts
import PocketBase from 'pocketbase';
import { QueryClient } from '@tanstack/solid-query';

const pb = new PocketBase('http://localhost:8090');
const queryClient = new QueryClient();

// Products
export const getProducts = () => 
  createQuery(() => ({
    queryKey: ['products'],
    queryFn: () => pb.collections.products.getFullList()
  }));

export const getProduct = (id: string) =>
  createQuery(() => ({
    queryKey: ['products', id],
    queryFn: () => pb.collections.products.getOne(id)
  }));

export const createProduct = async (data) => {
  const record = await pb.collections.products.create(data);
  queryClient.invalidateQueries(['products']);
  return record;
};
```

### Routing
```typescript
// App.tsx
import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Login = lazy(() => import('./pages/Login'));

export default function App() {
  return (
    <Router>
      <Route path="/" component={Layout}>
        <Route path="/" component={Dashboard} />
        <Route path="/products" component={Products} />
        <Route path="/products/new" component={ProductForm} />
        <Route path="/products/:id" component={ProductEdit} />
        <Route path="/categories" component={Categories} />
        <Route path="/services" component={Services} />
        <Route path="/settings" component={Settings} />
      </Route>
      <Route path="/login" component={Login} />
    </Router>
  );
}
```

---

## Docker Setup

### Dockerfile (Backend)
```dockerfile
# pocketbase/Dockerfile
FROM alpine:latest

RUN apk add --no-cache \
    unzip \
    wget \
    ca-certificates

WORKDIR /app

# Download PocketBase
ARG PB_VERSION=0.22.0
RUN wget https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip && \
    unzip pocketbase_${PB_VERSION}_linux_amd64.zip && \
    rm pocketbase_${PB_VERSION}_linux_amd64.zip

EXPOSE 8090

VOLUME ["/app/pb_data"]

CMD ["./pocketbase", "serve", "--http", "0.0.0.0:8090", "--dir", "/app/pb_data"]
```

### Dockerfile (Frontend)
```dockerfile
# client/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  pocketbase:
    build:
      context: ./pocketbase
      dockerfile: ../docker/Dockerfile
    ports:
      - "8090:8090"
    volumes:
      - ./pocketbase/pb_data:/app/pb_data
    environment:
      - PB_SECRET=<generated-secret>
    restart: unless-stopped

  client:
    build:
      context: ./client
      dockerfile: ../docker/Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - pocketbase
    restart: unless-stopped

  s3-sync:
    build:
      context: ./s3-sync
      dockerfile: ../docker/Dockerfile
    environment:
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET=${S3_BUCKET}
      - PB_URL=http://pocketbase:8090
    depends_on:
      - pocketbase
    restart: unless-stopped
```

---

## Helm Chart

### Chart Structure
```
helm/stjorna/
├── Chart.yaml
├── values.yaml
├── .helmignore
└── templates/
    ├── _helpers.tpl
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── pvc.yaml
    ├── configmap.yaml
    └── secret.yaml
```

### values.yaml
```yaml
replicaCount: 1

image:
  repository: secanis/stjorna
  pullPolicy: IfNotPresent
  pocketbaseTag: "0.22.0"
  clientTag: "latest"

pocketbase:
  storage: "/app/pb_data"
  secret: ""  # Set via secret
  port: 8090

client:
  port: 80

ingress:
  enabled: true
  className: "traefik"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: stjorna.example.com
      paths:
        - path: /
          pathType: Prefix

persistence:
  enabled: true
  size: 5Gi
  storageClass: "standard"
  accessMode: ReadWriteOnce

s3:
  enabled: true
  bucket: "stjorna-backups"
  region: "eu-central-1"
  syncInterval: "0 3 * * *"  # Daily at 3 AM

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

### Deployment Template
```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "stjorna.fullname" . }}
  labels:
    {{- include "stjorna.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "stjorna.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "stjorna.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: pocketbase
          image: "{{ .Values.image.repository }}:pocketbase-{{ .Values.image.pocketbaseTag }}"
          ports:
            - containerPort: {{ .Values.pocketbase.port }}
          volumeMounts:
            - name: pb-data
              mountPath: {{ .Values.pocketbase.storage }}
          env:
            - name: PB_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "stjorna.fullname" . }}
                  key: pocketbase-secret

        - name: client
          image: "{{ .Values.image.repository }}:client-{{ .Values.image.clientTag }}"
          ports:
            - containerPort: {{ .Values.client.port }}
          livenessProbe:
            httpGet:
              path: /
              port: {{ .Values.client.port }}
          readinessProbe:
            httpGet:
              path: /
              port: {{ .Values.client.port }}
```

---

## Migration Considerations

### From lowdb to PocketBase
1. Export all data from current JSON database
2. Create PocketBase collections with same schema
3. Import data via PocketBase Admin API or direct SQLite insertion
4. Update frontend API calls to use PocketBase SDK

### Data Export Script
```javascript
// migration/export.js
const lowdb = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
const fs = require('fs');

async function exportCurrentData() {
  const adapter = new FileAsync('./data/database.json');
  const db = await lowdb(adapter);

  const exportData = {
    categories: db.get('categories').value(),
    products: db.get('products').value(),
    services: db.get('services').value(),
    users: db.get('users').value(),
    exportedAt: new Date().toISOString()
  };

  fs.writeFileSync('export.json', JSON.stringify(exportData, null, 2));
  console.log('Exported data:', exportData);
}

exportCurrentData();
```

### Import to PocketBase
```javascript
// migration/import.js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://localhost:8090');
const fs = require('fs');

async function importData() {
  // Login as admin
  await pb.admins.authWithPassword('admin@stjorna.ch', 'password');

  const data = JSON.parse(fs.readFileSync('export.json'));

  // Import categories
  for (const cat of data.categories) {
    await pb.collections.categories.create(cat);
  }

  // Import products
  for (const prod of data.products) {
    await pb.collections.products.create(prod);
  }

  console.log('Import complete');
}

importData();
```

---

## Development Workflow

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- S3-compatible storage account

### Local Development
```bash
# Start infrastructure
docker-compose up -d pocketbase

# Start frontend with hot reload
cd client && npm run dev

# Initialize admin account
# Visit http://localhost:8090/_/ and create admin account
```

### Environment Variables
```env
# Client (.env)
VITE_PB_URL=http://localhost:8090

# PocketBase (env file)
PB_SECRET=your-generated-secret

# S3 Sync
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=eu-central-1
S3_BUCKET=stjorna-backups
```

### Key Commands
```bash
# Backend
cd pocketbase && ./pocketbase serve

# Frontend
cd client && npm run dev

# Build production
cd client && npm run build

# Docker build
docker-compose build

# Helm deploy
helm upgrade --install stjorna ./helm/stjorna -f ./helm/stjorna/values.yaml
```

---

## API Reference for Rewrite

### PocketBase REST API

**Authentication:**
```http
POST /api/collections/users/auth-with-password
Content-Type: application/json

{"identity": "user@example.com", "password": "password"}
```

**Products:**
```http
GET /api/collections/products/records
GET /api/collections/products/records/:id
POST /api/collections/products/records
PUT /api/collections/products/records/:id
DELETE /api/collections/products/records/:id
```

**Files:**
```http
GET /api/files/{collection}/{record_id}/{filename}
GET /api/files/{collection}/{record_id}/{filename}?thumb=100x100
```

**Export:**
```http
GET /api/collections/products/records?export=json
GET /api/collections/products/records?export=csv
```

---

## Notes for SaaS Deployment

1. **Multi-tenancy:** PocketBase supports separate databases per tenant or shared database with tenant filtering
2. **S3 Sync:** Regular backup of database and files to S3 for disaster recovery
3. **Rate Limiting:** Implement in front of PocketBase (Traefik middleware or dedicated service)
4. **SSL:** Always run behind HTTPS-terminating reverse proxy (Traefik, nginx)
5. **Scaling:** PocketBase is single-instance; for high load, consider read replicas or moving to managed PostgreSQL with Supabase
