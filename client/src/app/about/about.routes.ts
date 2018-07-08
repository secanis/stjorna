import { Routes } from '@angular/router';

import { AboutComponent } from './about.component';
import { AuthGuard } from '../shared/authGuard';

export const AboutRoutes: Routes = [
    {
        path: 'about',
        component: AboutComponent,
        canActivate: [AuthGuard]
    }
];
