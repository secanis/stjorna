import { Component, OnInit } from '@angular/core';

import { LoginStatusHandler } from './shared/login-handler.service';
import { Router } from '@angular/router';

import '../style/lux.min.css';
import '../style/style.css';
import { StjornaUserModel } from './models/user.model';

@Component({
    selector: 'stjorna-app',
    templateUrl: './app.component.html',
    styleUrls: ['app.component.css']
})
export class AppComponent implements OnInit {
    public toYear: Number;
    public loggedIn: Boolean = false;
    public currentUser: StjornaUserModel;

    constructor(private router: Router, private loginStatusHandler: LoginStatusHandler) { }

    ngOnInit() {
        this.loginStatusHandler.isLoggedIn().subscribe(result => {
            this.loggedIn = result;
            this.currentUser = this.loginStatusHandler.getCurrentUser();
        });
        this.loggedIn = this.loginStatusHandler.getLoginStatus();
    }

    public getActiveUrlRoute(path: string): boolean {
        if (location.pathname.includes(path)) {
            return true;
        } else {
            return false;
        }
    }
}
