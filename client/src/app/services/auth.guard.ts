import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { LoginHandlerService } from './login-handler.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private loginHandlerService: LoginHandlerService
    ) { }

    public canActivate() {
        if (this.loginHandlerService.getLoginStatus()) {
            // logged in so return true
            return true;
        }
        // not logged in so redirect to login page and return true
        // login controll will verify the auth token...
        this.router.navigateByUrl('/login');
        return true;
    }
}
