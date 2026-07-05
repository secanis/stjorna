import { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { getTestCredentials, getTenantId, pb } from './global-setup';

export { pb, getTestCredentials, getTenantId, expect };

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

  async loginAsAdmin() {
    await this.page.goto(this.frontendUrl + '/login');
    await this.page.getByRole('button', { name: 'Admin Login' }).click();
    await this.page.getByLabel('Email').fill(this.credentials.adminEmail);
    await this.page.getByLabel('Password').fill(this.credentials.adminPassword);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.page.waitForURL('**/');
  }

  async loginAsUser() {
    await this.page.goto(this.frontendUrl + '/login');
    await this.page.getByRole('button', { name: 'User Login' }).click();
    await this.page.getByLabel('Email').fill(this.credentials.userEmail);
    await this.page.getByLabel('Password').fill(this.credentials.userPassword);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.page.waitForURL('**/');
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