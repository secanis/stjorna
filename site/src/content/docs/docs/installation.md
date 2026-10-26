---
title: Installation
description: Deploy STJÓRNA with Docker Compose or the Helm chart for Kubernetes.
---

STJÓRNA runs as two services — a PocketBase backend and a SolidJS frontend — in front of either
Docker Compose or Kubernetes.

## Docker Compose

The repository ships a `docker-compose.yml` that builds and runs both services locally:

```bash
cp .env.example .env
# set PB_SECRET (32 ASCII chars) and PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD
docker compose up -d
```

- The frontend listens on <http://localhost:3000>.
- PocketBase is bound to `127.0.0.1:8090` (its admin UI is at <http://127.0.0.1:8090/_/>).
- Data lives in the named volume `pb_data` and survives `docker compose down`
  (`docker compose down -v` deletes it).

:::caution
Never publish PocketBase on `0.0.0.0` on an exposed host — superuser login is sensitive.
:::

## Helm (Kubernetes)

The chart provisions the PocketBase backend, the SolidJS frontend, an optional self-hosted S3
(Garage) dependency, and a TLS-terminating ingress.

### Prerequisites

- Kubernetes **>= 1.20**
- **Helm 3** (tested with Helm 4; works with 3.x)
- An **ingress controller** (tested with Traefik)
- **cert-manager** (tested with a `letsencrypt` ClusterIssuer)
- A **storage class** for the PocketBase PVC (default: `longhorn`)

### Add the repository

```bash
helm repo add stjorna https://secanis.github.io/stjorna
helm repo update
```

### Install

```bash
helm install stjorna stjorna/stjorna \
  --set ingress.hosts[0].host=stjorna.yourdomain.com
```

Use a values file for production:

```yaml
# my-prod-values.yaml
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

```bash
helm install stjorna stjorna/stjorna -f my-prod-values.yaml -n stjorna
```

The `helm install` output prints the `kubectl get secret` commands to read the generated superuser
credentials.

### First run

The chart creates the first superuser headlessly on the first pod start (a Secret is mounted as
`PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`). Open `https://<your-host>/setup` and sign in with
those credentials to walk through storage, tenant and admin-link steps.

### Upgrade

```bash
helm upgrade stjorna stjorna/stjorna -f my-prod-values.yaml -n stjorna
```

Upgrades are **data-safe**: the Namespace, the PocketBase PVC and the `PB_SECRET` Secret carry
`helm.sh/resource-policy: keep`, so `helm upgrade` and `helm uninstall` leave them in place.

### Uninstall

```bash
helm uninstall stjorna -n stjorna
```

`helm uninstall` does **not** delete the Namespace, the PVC or the `PB_SECRET` Secret. Reclaim
storage manually with `kubectl delete namespace` / `kubectl delete pvc` when you are sure.

:::tip
The full chart reference — including the optional Garage S3 subchart, custom secrets and networking
values — lives on the
[chart's Artifact Hub page](https://artifacthub.io/packages/helm/stjorna/stjorna).
:::
