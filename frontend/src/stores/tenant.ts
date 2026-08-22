/*
 * Tenant-change bus.
 * ==================
 * Holds a single `version` counter that bumps any time the active
 * tenant changes (login, switchTenant, logout). Reactive code that
 * *depends* on which tenant is active reads this counter inside its
 * tracked context so Solid re-evaluates on bump.
 *
 * Why this exists (rather than users reading `authStore.currentTenant`
 * directly):
 *
 *  - `authStore.currentTenant` flips *before* the page React world
 *    has had a chance to re-render. createResource source signals
 *    track getter calls reactively, but most pages used to read
 *    `getCurrentTenant()` *imperatively* (a plain function call) at
 *    the top of their fetcher. Without a tracked subscription, a
 *    switch-tenant mutation had no effect on the resource — the
 *    page showed stale data from the previous tenant.
 *
 *  - Sidebar's count badges need to recompute on tenant change
 *    too. They used to listen for `sidebarStore.version`, which is
 *    bumped only on CRUD mutations, never on tenant switching.
 *
 * Both now subscribe to `tenantStore.version`. Subscribers:
 *   - Sidebar (via the same effect it already had, now also
 *     tracking tenantStore.version).
 *   - All tenant-scoped createResource sources (MediaList,
 *     CategoryList, ProductList, Activities, Dashboard,
 *     UserManagement, the rest) include `tenantStore.version()` in
 *     their source accessor so they refetch when the active tenant
 *     changes.
 */

import { createSignal } from 'solid-js';

const [version, setVersion] = createSignal(0);

export const tenantStore = {
  get version() {
    return version();
  },
  bump() {
    setVersion((v) => v + 1);
  },
};
