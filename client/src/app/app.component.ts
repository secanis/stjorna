import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { StjornaService } from './shared/stjorna.service';
import { LoginStatusHandler } from './shared/login-handler.service';
import { TranslateService } from './shared/translate.service';

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

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private loginStatusHandler: LoginStatusHandler,
        private translateService: TranslateService
    ) { }

    ngOnInit() {
        // check if we are in an inital setup
        this.stjornaService.getSetupDefaults().subscribe(result => {
            if (result.message !== 'installation done' && result.status !== 'ok') {
                this.router.navigate(['setup']);
            }
        });

        // set initial language
        this.currentUser = this.loginStatusHandler.getCurrentUser();
        this.loginStatusHandler.isLoggedIn().subscribe(result => {
            this.loggedIn = result;
            if (this.currentUser) {
                this.translateService.use(this.currentUser.language);
            }
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
