import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { StjornaService } from '../shared/stjorna.service';

import { LoginStatusHandler } from '../shared/login-handler.service';
import { StjornaUserModel } from '../models/user.model';

@Component({
    selector: 'stjorna-login',
    templateUrl: 'login.component.html',
    styleUrls: ['login.component.css']
})

export class LoginComponent implements OnInit {
    public login: StjornaUserModel = {
        _id: null,
        email: '',
        username: '',
        password: '',
        token: '',
        language: ''
    };

    constructor(
        private router: Router,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private loginStatusHandler: LoginStatusHandler
    ) { }

    ngOnInit() {
        if (this.loginStatusHandler.getLoginStatus()) {
            this.stjornaService.verifyAuthToken().subscribe(
                result => {
                    if (result && result.status === 'info') {
                        this.router.navigateByUrl(`/dashboard`);
                    }
                },
                err => {
                    this.loginStatusHandler.setLoginStatus(false);
                });
        }
    }

    public performLogin(user: StjornaUserModel) {
        this.stjornaService.authenticateUser(user).subscribe(result => this.loginDoneAction(result));
    }

    private loginDoneAction(result) {
        if (result.token) {
            let currentUser = {
                _id: result._id,
                username: result.username,
                password: null,
                email: result.email,
                token: result.token,
                language: result.language
            };
            this.loginStatusHandler.setCurrentUser(currentUser);
            this.loginStatusHandler.setLoginStatus(true);
            this.router.navigateByUrl('/dashboard');
        } else {
            this.toastr.error(result.message, 'Couldn\'t login...');
        }
    }
}
