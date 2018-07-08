import { RouterModule, Routes } from '@angular/router';

import { DashboardRoutes } from './dashboard/dashboard.routes';
import { AboutRoutes } from './about/about.routes';
import { SetupRoutes } from './setup/setup.routes';
import { NewProductRoutes } from './new-product/new-product.routes';
import { ViewProductRoutes } from './view-product/view-product.routes';
import { ProfileRoutes } from './profile/profile.routes';
import { SettingsRoutes } from './settings/settings.routes';
import { LoginRoutes } from './login/login.routes';

const routes: Routes = [
    ...DashboardRoutes,
    ...AboutRoutes,
    ...SetupRoutes,
    ...NewProductRoutes,
    ...ViewProductRoutes,
    ...ProfileRoutes,
    ...SettingsRoutes,
    ...LoginRoutes,
    { path: '**', redirectTo: '/dashboard' }
];

export const routing = RouterModule.forRoot(routes);
