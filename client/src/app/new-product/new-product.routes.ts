import { Routes } from '@angular/router';

import { NewProductComponent } from './new-product.component';

export const NewProductRoutes: Routes = [
    {
        path: 'new/product',
        component: NewProductComponent
    },
    {
        path: 'new/category',
        component: NewProductComponent
    }
];
