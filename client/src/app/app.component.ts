import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from './models/user';
import { StjornaService } from './services/stjorna.service';
import { LoginHandlerService } from './services/login-handler.service';
import { TranslateService } from './services/translate.service';
import { Observable } from 'rxjs';
import { Config } from './models/config';
import { map } from 'rxjs/operators';

@Component({
    selector: 'stjorna-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    public toYear: Number;
    public loggedIn: Boolean = false;
    public currentUser: User;
    public config$: Observable<Config>;

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private loginHandlerService: LoginHandlerService,
        private translateService: TranslateService
    ) { }

    ngOnInit() {
        // check if we are in an inital setup
        this.stjornaService.getSetupDefaults().subscribe(result => {
            if (
                result.message !== 'installation done' &&
                result.status !== 'ok'
            ) {
                this.router.navigate(['setup']);
            }
        });

        // set initial language
        this.currentUser = this.loginHandlerService.getCurrentUser();
        this.loginHandlerService.isLoggedIn().subscribe(result => {
            this.currentUser = this.loginHandlerService.getCurrentUser();
            this.loggedIn = result;
            if (this.currentUser) {
                this.translateService.use(this.currentUser.language);
                this.config$ = this.stjornaService.getSettings().pipe(
                    map(r => new Config(
                        r.password_secret,
                        r.allow_remote_access,
                        r.image,
                        r.installed,
                        r.modules
                    ))
                );
            }
        });
        this.loggedIn = this.loginHandlerService.getLoginStatus();
    }

    public getActiveUrlRoute(path: string): boolean {
        if (location.pathname.includes(path)) {
            return true;
        } else {
            return false;
        }
    }
}
