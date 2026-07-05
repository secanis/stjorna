---

## Frontend Implementation Plan

A detailed implementation plan for the SolidJS frontend is stored at:
**`.opencode/plans/stjorna-frontend-plan.md`**

### Quick Reference

**Stack:** SolidJS + TypeScript, TailwindCSS, @solidjs/router, @tanstack/solid-query, PocketBase SDK

**Key decisions:**
- Multi-tenant via `user_tenants` junction table (user can belong to multiple tenants with per-tenant roles)
- Roles: `viewer`, `editor`, `tenant_admin`, `pb_admin` (PocketBase system admin)
- Setup page at `/setup` (only when no admin exists), then redirects to `/login`
- Unified login page for both PB admins and tenant users
- Tenant switcher in sidebar for users with access to multiple tenants
- API rules as guardrails, frontend always sends explicit tenant filter

**Implementation order:** Scaffolding → Auth Store → Setup/Login → Layout → Dashboard → Media → Settings/Users → Docker