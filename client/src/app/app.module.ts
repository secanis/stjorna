import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule, LOCALE_ID, APP_INITIALIZER } from '@angular/core';
import { ToastrModule } from 'ngx-toastr';
import { ImageCropperModule } from 'ngx-image-cropper';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CategoryFormComponent } from './components/category-form/category-form.component';
import { CategoryListComponent } from './components/category-list/category-list.component';
import { ImageCropperComponent } from './components/image-cropper/image-cropper.component';
import { LogoutComponent } from './components/logout/logout.component';
import { ProductFormComponent } from './components/product-form/product-form.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { SearchbarComponent } from './components/searchbar/searchbar.component';
import { ServiceFormComponent } from './components/service-form/service-form.component';
import { ServiceListComponent } from './components/service-list/service-list.component';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { AboutComponent } from './pages/about/about.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { NewProductComponent } from './pages/new-product/new-product.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { SetupComponent } from './pages/setup/setup.component';
import { ViewProductComponent } from './pages/view-product/view-product.component';
import { SearchPipe } from './pipes/search.pipe';
import { TranslatePipe } from './pipes/translate.pipe';

// import and register locales
import { registerLocaleData } from '@angular/common';
import lcoaleDECH from '@angular/common/locales/de-CH';
import { StjornaService } from './services/stjorna.service';
import { HelperService } from './services/helper.service';
import { TranslateService } from './services/translate.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { LoginHandlerService } from './services/login-handler.service';
import { AuthGuard } from './services/auth.guard';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
registerLocaleData(lcoaleDECH);

@NgModule({
    declarations: [
        AppComponent,
        CategoryFormComponent,
        CategoryListComponent,
        ImageCropperComponent,
        LogoutComponent,
        ProductFormComponent,
        ProductListComponent,
        SearchbarComponent,
        ServiceFormComponent,
        ServiceListComponent,
        SpinnerComponent,
        AboutComponent,
        DashboardComponent,
        LoginComponent,
        NewProductComponent,
        ProfileComponent,
        SettingsComponent,
        SetupComponent,
        ViewProductComponent,
        SearchPipe,
        TranslatePipe
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        HttpClientModule,
        FormsModule,
        ToastrModule.forRoot(),
        ImageCropperModule,
        NgbModule
    ],
    providers: [
        StjornaService,
        HelperService,
        TranslateService,
        ErrorHandlerService,
        LoginHandlerService,
        AuthGuard, {
            provide: LOCALE_ID,
            useValue: 'de-CH'
        }, {
            provide: APP_INITIALIZER,
            useFactory: setupTranslateFactory,
            deps: [TranslateService],
            multi: true
        }
    ],
    bootstrap: [AppComponent]
})

export class AppModule { }

// TODO: is this the code which executes 2 times the load command?
export function setupTranslateFactory(
    service: TranslateService): Function {
    return () => service.use('en');
}
