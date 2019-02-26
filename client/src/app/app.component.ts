import { Component, OnInit } from '@angular/core';

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

    constructor(private loginStatusHandler: LoginStatusHandler, private translateService: TranslateService) { }

    ngOnInit() {
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
