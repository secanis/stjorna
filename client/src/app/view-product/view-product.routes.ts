import { Routes } from '@angular/router';

import { ViewProductComponent } from './view-product.component';
import { AuthGuard } from '../shared/authGuard';

export const ViewProductRoutes: Routes = [
    {
        path: 'product/view/:id',
        component: ViewProductComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'category/view/:id',
        component: ViewProductComponent,
        canActivate: [AuthGuard]
    }
];
