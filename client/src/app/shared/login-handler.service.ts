import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

import { StjornaUserModel } from '../models/user.model';

@Injectable()
export class LoginStatusHandler {
    private loginStatus = new BehaviorSubject<boolean>(false);

    constructor() { }

    public setLoginStatus(status: boolean) {
        if (!status) {
            localStorage.removeItem('currentUser');
        }
        this.loginStatus.next(status);
    }

    public getLoginStatus() {
        if (this.getCurrentUser() && this.getCurrentUser().token) {
            this.setLoginStatus(true);
        }
        return this.loginStatus.getValue();
    }

    public isLoggedIn(): Observable<boolean> {
        return this.loginStatus.asObservable();
    }

    public setCurrentUser(user: StjornaUserModel) {
        if (user) {
            let obj = {
                _id: user._id,
                email: user.email,
                username: user.username,
                password: '',
                token: user.token || this.getCurrentUser().token || ''
            };
            localStorage.setItem('currentUser', JSON.stringify(obj));
        }
        // no user will be set, because of an empty param
    }

    public getCurrentUser(): StjornaUserModel {
        let user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            return {
                _id: user._id,
                email: user.email,
                username: user.username,
                password: '',
                token: user.token
            }
        } else {
            return null;
        }
    }
}
