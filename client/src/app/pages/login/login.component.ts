import { Component, OnInit } from '@angular/core';
import { User } from 'src/app/models/user';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { StjornaService } from 'src/app/services/stjorna.service';
import { LoginHandlerService } from 'src/app/services/login-handler.service';

@Component({
    selector: 'stjorna-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
    public login: User = {
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
        private loginHandlerService: LoginHandlerService
    ) { }

    ngOnInit() {
        if (this.loginHandlerService.getLoginStatus()) {
            this.stjornaService.verifyAuthToken().subscribe(
                result => {
                    if (result && result.status === 'info') {
                        this.router.navigateByUrl(`/dashboard`);
                    }
                },
                err => {
                    this.loginHandlerService.setLoginStatus(false);
                });
        }
    }

    public performLogin(user: User) {
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
            this.loginHandlerService.setCurrentUser(currentUser);
            this.loginHandlerService.setLoginStatus(true);
            this.router.navigateByUrl('/dashboard');
        } else {
            this.toastr.error(result.message, 'Couldn\'t login...');
        }
    }
}
