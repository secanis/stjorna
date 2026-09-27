import { Page } from '@playwright/test';
import { test as base, expect } from './ai-fixture';
import { getTestCredentials, getTenantId, pb, readE2EState } from './global-setup';

export { pb, getTestCredentials, getTenantId, expect, readE2EState };

export class TestContext {
  readonly page: Page;
  readonly credentials: ReturnType<typeof getTestCredentials>;
  readonly pbUrl: string;
  readonly frontendUrl: string;
  readonly tenantId: string | null;

  constructor(page: Page) {
    this.page = page;
    this.credentials = getTestCredentials();
    this.pbUrl = this.credentials.pbUrl;
    this.frontendUrl = this.credentials.frontendUrl;
    this.tenantId = getTenantId();
  }

  // /login is the tenant-user form; superusers sign in on /superlogin.
  // Both render LoginCard, whose submit button is "Sign In". Match it
  // exactly: Playwright's name match is a case-insensitive substring, and
  // the "Superuser login" link on /login would otherwise also match.
  async loginAsAdmin() {
    await this.login('/superlogin', this.credentials.adminEmail, this.credentials.adminPassword);
  }

  async loginAsUser() {
    await this.login('/login', this.credentials.userEmail, this.credentials.userPassword);
  }

  private async login(path: string, email: string, password: string) {
    await this.page.goto(this.frontendUrl + path);
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await this.page.waitForURL((url) => url.pathname === '/');
  }

  async waitForDashboard() {
    await this.page.waitForSelector('h1:has-text("Dashboard")');
  }
}

function createContext(page: Page) {
  return new TestContext(page);
}

export { base as test };

export function getContext(page: Page) {
  return createContext(page);
}