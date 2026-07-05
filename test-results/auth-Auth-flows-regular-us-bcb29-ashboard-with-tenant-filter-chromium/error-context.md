# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Auth flows >> regular user login redirects to dashboard with tenant filter
- Location: tests/e2e/auth.spec.ts:31:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('h1:has-text("Dashboard")') to be visible
    - locator resolved to visible <h1 class="text-2xl font-bold text-white">Dashboard</h1>

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "STJÓRNA" [level=1] [ref=e6]
    - paragraph [ref=e7]: Sign in to your account
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]: PocketBase URL
      - textbox "PocketBase URL" [ref=e11]: http://localhost:8090
    - generic [ref=e12]:
      - button "User Login" [ref=e13] [cursor=pointer]
      - button "Admin Login" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]: Email
      - textbox "Email" [ref=e17]
    - generic [ref=e18]:
      - generic [ref=e19]: Password
      - textbox "Password" [ref=e20]
    - button "Sign In" [ref=e21] [cursor=pointer]
  - button "First-time setup?" [ref=e23] [cursor=pointer]
```

# Test source

```ts
  1  | import { Page } from '@playwright/test';
  2  | import { test as base, expect } from '@playwright/test';
  3  | import { getTestCredentials, getTenantId, pb } from './global-setup';
  4  | 
  5  | export { pb, getTestCredentials, getTenantId, expect };
  6  | 
  7  | export class TestContext {
  8  |   readonly page: Page;
  9  |   readonly credentials: ReturnType<typeof getTestCredentials>;
  10 |   readonly pbUrl: string;
  11 |   readonly frontendUrl: string;
  12 |   readonly tenantId: string | null;
  13 | 
  14 |   constructor(page: Page) {
  15 |     this.page = page;
  16 |     this.credentials = getTestCredentials();
  17 |     this.pbUrl = this.credentials.pbUrl;
  18 |     this.frontendUrl = this.credentials.frontendUrl;
  19 |     this.tenantId = getTenantId();
  20 |   }
  21 | 
  22 |   async loginAsAdmin() {
  23 |     await this.page.goto(this.frontendUrl + '/login');
  24 |     await this.page.getByRole('button', { name: 'Admin Login' }).click();
  25 |     await this.page.getByLabel('Email').fill(this.credentials.adminEmail);
  26 |     await this.page.getByLabel('Password').fill(this.credentials.adminPassword);
  27 |     await this.page.getByRole('button', { name: 'Sign In' }).click();
  28 |     await this.page.waitForURL('**/');
  29 |   }
  30 | 
  31 |   async loginAsUser() {
  32 |     await this.page.goto(this.frontendUrl + '/login');
  33 |     await this.page.getByRole('button', { name: 'User Login' }).click();
  34 |     await this.page.getByLabel('Email').fill(this.credentials.userEmail);
  35 |     await this.page.getByLabel('Password').fill(this.credentials.userPassword);
  36 |     await this.page.getByRole('button', { name: 'Sign In' }).click();
  37 |     await this.page.waitForURL('**/');
  38 |   }
  39 | 
  40 |   async waitForDashboard() {
> 41 |     await this.page.waitForSelector('h1:has-text("Dashboard")');
     |                     ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  42 |   }
  43 | }
  44 | 
  45 | function createContext(page: Page) {
  46 |   return new TestContext(page);
  47 | }
  48 | 
  49 | export { base as test };
  50 | 
  51 | export function getContext(page: Page) {
  52 |   return createContext(page);
  53 | }
```