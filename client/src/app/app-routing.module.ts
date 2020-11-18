import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SetupComponent } from './pages/setup/setup.component';
import { AboutComponent } from './pages/about/about.component';
import { AuthGuard } from './services/auth.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { NewProductComponent } from './pages/new-product/new-product.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ViewProductComponent } from './pages/view-product/view-product.component';

const routes: Routes = [
    // dashboard
    { path: 'dashboard', redirectTo: 'dashboard/products' },
    { path: 'dashboard/:tab', component: DashboardComponent, canActivate: [AuthGuard] },
    // about
    { path: 'about', component: AboutComponent, canActivate: [AuthGuard] },
    // profile
    { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
    { path: 'profile/:username', component: ProfileComponent, canActivate: [AuthGuard] },
    // new ressource
    { path: 'new/product', component: NewProductComponent },
    { path: 'new/service', component: NewProductComponent },
    { path: 'new/category', component: NewProductComponent },
    // view ressource
    { path: 'product/view/:id', component: ViewProductComponent },
    { path: 'service/view/:id', component: ViewProductComponent },
    { path: 'category/view/:id', component: ViewProductComponent },
    // login
    { path: 'login', component: LoginComponent },
    // settings
    { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
    // setup
    { path: 'setup', component: SetupComponent },
    // default route
    { path: '**', redirectTo: '/dashboard/products' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
