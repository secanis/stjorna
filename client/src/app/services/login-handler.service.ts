import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user';

@Injectable({
    providedIn: 'root'
})
export class LoginHandlerService {
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

    public setCurrentUser(user: User) {
        if (user) {
            const obj = {
                _id: user._id,
                email: user.email,
                username: user.username,
                password: '',
                token: user.token || this.getCurrentUser().token || '',
                language: user.language
            };
            localStorage.setItem('currentUser', JSON.stringify(obj));
        }
        // no user will be set, because of an empty param
    }

    public getCurrentUser(): User {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            return {
                _id: user._id,
                email: user.email,
                username: user.username,
                password: '',
                token: user.token,
                language: user.language
            };
        } else {
            return null;
        }
    }
}
