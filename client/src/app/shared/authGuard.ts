import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';

import { LoginStatusHandler } from './login-handler.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private loginStatusHandler: LoginStatusHandler
    ) { }

    public canActivate() {
        if (this.loginStatusHandler.getLoginStatus()) {
            // logged in so return true
            return true;
        }
        // not logged in so redirect to login page and return true
        // login controll will verify the auth token...
        this.router.navigateByUrl('/login');
        return true;
    }

}
