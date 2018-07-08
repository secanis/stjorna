import { Routes } from '@angular/router';

import { SettingsComponent } from './settings.component';
import { AuthGuard } from '../shared/authGuard';

export const SettingsRoutes: Routes = [
    {
        path: 'settings',
        component: SettingsComponent,
        canActivate: [AuthGuard]
    }
];
