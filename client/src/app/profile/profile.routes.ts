import { Routes } from '@angular/router';

import { ProfileComponent } from './profile.component';
import { AuthGuard } from '../shared/authGuard';

export const ProfileRoutes: Routes = [
    {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'profile/:username',
        component: ProfileComponent,
        canActivate: [AuthGuard]
    }
];
