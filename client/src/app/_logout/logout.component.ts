import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { LoginStatusHandler } from '../shared/login-handler.service';

@Component({
    selector: 'stjorna-logout',
    template: `
        <li class="nav-link stjorna-logout-button" (click)="logoutUser()">
            <i class="stjorna-logout-button fa fa-sign-out"></i> Logout
        </li>
    `,
    styles: [`
        .stjorna-logout-button {
            cursor: pointer;
            line-height: 50px;
        }
    `]
})

export class LogoutComponent implements OnInit {
    constructor(private router: Router, private loginStatusHandler: LoginStatusHandler) { }

    ngOnInit() { }

    public logoutUser() {
        // let user = JSON.parse(localStorage.getItem('currentUser')).token;
        localStorage.removeItem('currentUser');
        this.loginStatusHandler.setLoginStatus(false);
        this.router.navigateByUrl('/login');
    }
}
