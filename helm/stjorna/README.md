# STJÓRNA Helm Chart

Multi-tenant product management: PocketBase backend + SolidJS frontend, deployed to Kubernetes.

## Prerequisites

- Kubernetes **>= 1.20**
- **Helm 3** (tested with Helm 4; works with 3.x as well)
- A working **ingress controller** (chart tested with Traefik)
- A **cert-manager** installation (chart tested with `letsencrypt` ClusterIssuer)
- A **storage class** for the PocketBase PVC (default: `longhorn`)

> [!TIP]
> **PVC size depends on storage backend.**
> PocketBase's data directory holds both the sqlite database (KBs) and
> user-uploaded media (GBs/TBs). If you configure S3 storage in the
> setup wizard (or use the optional `garage` subchart below), media
> goes to S3 and the PVC only needs ~1-2GiB. Without S3, size the PVC
> to fit your expected media library.

## TL;DR

```bash
# 1. Build and push images (one-time per release)
podman build -t docker.io/secanis/stjorna-pocketbase:v3.0.0-rc1 \
  -f docker/Dockerfile.pocketbase pocketbase
podman push docker.io/secanis/stjorna-pocketbase:v3.0.0-rc1

podman build -t docker.io/secanis/stjorna-frontend:v3.0.0-rc1 \
  -f frontend/Dockerfile frontend
podman push docker.io/secanis/stjorna-frontend:v3.0.0-rc1

# 2. Install (replace the hostname!)
helm install stjorna ./helm/stjorna \
  --set ingress.hosts[0].host=stjorna.yourdomain.com
```

## Install

```bash
# Use a custom values file for production
helm install stjorna ./helm/stjorna \
  -f my-prod-values.yaml \
  -n stjorna
```

Minimal override (`my-prod-values.yaml`):

```yaml
ingress:
  hosts:
    - host: stjorna.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - hosts:
        - stjorna.yourdomain.com
      secretName: stjorna-tls

pocketbase:
  persistence:
    size: 20Gi
```

## First-run

1. Open `https://<your-host>/_/` in a browser.
2. Create the initial PocketBase superuser (email + password).
3. The setup wizard at `https://<your-host>/` will guide you through tenants, roles, categories, and storage.

## Upgrading

```bash
helm upgrade stjorna ./helm/stjorna \
  -f my-prod-values.yaml \
  -n stjorna
```

When upgrading PocketBase versions, the PB data PVC is preserved (reclaimPolicy: Retain). The PB data directory is `data.db` (sqlite) plus `storage/` (uploads).

## Uninstalling

```bash
helm uninstall stjorna -n stjorna
```

The PocketBase **PVC is preserved** (reclaimPolicy: Retain). To delete the data:

```bash
kubectl delete pvc -n stjorna -l app.kubernetes.io/name=stjorna,app.kubernetes.io/component=pocketbase
kubectl delete pv -n stjorna <pv-name-from-previous-output>
```

## Optional: Self-hosted S3 with Garage

STJÓRNA can use any S3-compatible storage for media uploads. For self-hosted deployments, the chart includes an optional dependency on [Garage](https://garagehq.deuxfleurs.fr/), a lightweight S3-compatible object store designed for small clusters.

The Garage subchart is **off by default**. Enable it with `garage.enabled=true` and pass through the same storage class / sizing you want.

### Install with Garage enabled

1. **Clone the garage repo as a sibling directory**. The chart uses a local path dependency (`file://../garage`), so the source must be on disk:

   ```bash
   cd ..                                          # parent of the stjorna repo
   git clone --branch v1.3.1 --depth 1 \
     https://git.deuxfleurs.fr/Deuxfleurs/garage
   cd stjorna/helm/stjorna
   helm dep build                                # packages garage into ./charts/
   ```

   The `charts/garage-*.tgz` artifact is gitignored; the user runs `helm dep build` themselves. To re-build after upgrading the garage version, edit `dependencies[].version` in `Chart.yaml` and re-run.

2. **Install stjorna with garage enabled**:

   ```bash
   helm install stjorna ./helm/stjorna \
     --set garage.enabled=true \
     --set garage.ingress.s3.api.hosts[0].host=s3.yourdomain.com \
     --set garage.ingress.s3.api.tls[0].hosts[0]=s3.yourdomain.com \
     --set ingress.hosts[0].host=stjorna.yourdomain.com
   ```

3. **Initialize the garage cluster layout** (Garage requires this once after install). The single-node shortcut from Garage v2.x does not apply here since v1.3.1 is the tracked chart version:

   ```bash
   # Check garage status — all nodes will be "unconfigured" on first boot
   kubectl exec -n stjorna garage-0 -- ./garage status

   # Follow the manual cluster-layout procedure:
   # https://garagehq.deuxfleurs.fr/documentation/quick-start/#creating-a-cluster-layout
   ```

4. **Create a bucket and access key** in Garage:

   ```bash
   kubectl exec -n stjorna garage-0 -- ./garage bucket create stjorna-media
   kubectl exec -n stjorna garage-0 -- ./garage key create stjorna-key
   ```

5. **Configure STJÓRNA to use Garage** via the setup wizard (Admin → Storage step) or directly via PB's settings:

   - **Endpoint**: `http://garage.stjorna.svc.cluster.local:3900` (in-cluster)
     or `https://s3.yourdomain.com` (if you enabled the ingress above)
   - **Bucket**: `stjorna-media`
   - **Access key + secret**: from the `garage key create` output above
   - **Force path style**: `true` (required for Garage)

After that, the PocketBase PVC only needs to hold the sqlite database (1-2GiB); media uploads go to Garage.

### Sizing the Garage data PVC

Garage replicates data across the `garage.replicaCount` pods. With the default `replicaCount: 3` and a target total media size of, say, 50 GB, set `garage.persistence.data.size: 25Gi` (≈ total / (replicaCount − 1) for the default replication factor of 2).

### Sizing the PocketBase PVC

When Garage is enabled, drop the PocketBase PVC to ~1-2GiB:

```yaml
pocketbase:
  persistence:
    size: 2Gi
```

## Configuration

### Bring-your-own PB_SECRET

By default the chart auto-generates a `Secret` containing `PB_SECRET` on the first install (pre-install hook). To supply your own:

```bash
kubectl create secret generic stjorna-pb-secret \
  --from-literal=PB_SECRET=$(openssl rand -hex 32) \
  -n stjorna

helm install stjorna ./helm/stjorna \
  --set pocketbase.secret.existingSecret=stjorna-pb-secret \
  --set ingress.hosts[0].host=stjorna.yourdomain.com
```

### Custom image registry / private registry

```yaml
image:
  pullSecrets:
    - name: my-registry-pull-secret

pocketbase:
  image:
    repository: registry.example.com/stjorna/pocketbase
    tag: v3.0.0-rc1

frontend:
  image:
    repository: registry.example.com/stjorna/frontend
    tag: v3.0.0-rc1
```

### VITE_PB_URL

`VITE_PB_URL` is a **build-time** variable baked into the frontend image by Vite. The chart does **not** override it. In-cluster, the frontend proxies `/api/*` to the PocketBase service via nginx, so the default build works without any override.

If you need to point the frontend at a different PB (e.g., a public PB for storefront mode), rebuild the frontend image with `VITE_PB_URL` set:

```bash
podman build -t docker.io/secanis/stjorna-frontend:v3.0.0-rc1 \
  --build-arg VITE_PB_URL=https://pb.yourdomain.com \
  -f frontend/Dockerfile frontend
```

(Requires the `frontend/Dockerfile` to forward the arg; the current Dockerfile doesn't. To enable, edit the `builder` stage to add `ARG VITE_PB_URL` before `npm run build`.)

### Hooks iteration

PocketBase hook files live in `helm/stjorna/files/hooks/*.pb.js`. The chart ships them as a ConfigMap mounted at `/app/pb_hooks`. The `docker/Dockerfile.pocketbase` copies the same files from `pocketbase/pb_hooks/` (so local dev with `docker compose` works), and the chart's `files/hooks/` keeps an in-chart copy for the helm install.

> **Keep the two locations in sync.** When you add/edit a hook, update both:
>
> ```bash
> cp pocketbase/pb_hooks/*.pb.js helm/stjorna/files/hooks/
> git add pocketbase/pb_hooks/ helm/stjorna/files/hooks/
> ```

To update a hook on a running release:

1. Edit the file in `helm/stjorna/files/hooks/`.
2. `helm upgrade stjorna ./helm/stjorna -n stjorna`.
3. PB's `HooksWatch` reloads changed files on the next request.

> **Note:** `HooksWatch` only re-loads **changed** existing files. Renaming a file or adding a new one requires `kubectl rollout restart deployment/stjorna-pocketbase -n stjorna`.

## Backup

```bash
POD=$(kubectl get pod -n stjorna -l app.kubernetes.io/component=pocketbase -o name | head -1)
kubectl exec -n stjorna "$POD" -- \
  sh -c 'sqlite3 /app/pb_data/data.db ".backup /app/pb_data/backup-$(date +%F).db"'
kubectl cp stjorna/"$POD":/app/pb_data/backup-$(date +%F).db ./pb-backup.db
```

The PB `storage/` directory also contains user uploads; back it up via `kubectl cp` or a Longhorn snapshot of the PVC.

## Hooks tested

`helm test stjorna -n stjorna` runs a Pod that curls PocketBase's `/api/health` endpoint.

## Architecture

```
Internet
   │  (TLS via cert-manager + letsencrypt)
   ▼
[Ingress: traefik]
   │
   ▼
┌──────────────────────┐
│  frontend (2× Pods)  │  nginx + Vite build
│  nginx:80            │  /api/* → stjorna-pocketbase:8090
└──────────────────────┘
   │
   ▼
┌──────────────────────┐
│  pocketbase (1× Pod) │  PocketBase v0.22.7
│  :8090               │  /app/pb_data → PVC (longhorn, 5Gi, Retain)
│                      │  /app/pb_hooks → ConfigMap
└──────────────────────┘
```
