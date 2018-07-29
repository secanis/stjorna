import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { Observable, of } from 'rxjs';

import { LoginStatusHandler } from './login-handler.service';

export type HandleError = <T> (operation?: string, result?: T) => (error: HttpErrorResponse) => Observable<T>;

@Injectable()
export class HttpErrorHandler {
    constructor(private router: Router, private toastr: ToastrService, private loginStatusHandler: LoginStatusHandler) { }

    public createHandleError = (serviceName = '') =>
        <T> (operation = 'operation', result = {} as T) =>
        this.handleError(serviceName, operation, result);

    public handleError<T>(serviceName = '', operation = 'operation', result = {} as T) {
        return (error: HttpErrorResponse): Observable<T> => {
            if (error.status === 401) {
                this.loginStatusHandler.setLoginStatus(false);
                this.router.navigateByUrl(`/login`);
            } else if (error.status === 403) {
                this.loginStatusHandler.setLoginStatus(false);
            } else {
                this.toastr.error(error.error.message, `${serviceName}:${operation}`);
                return of(result);
            }
        };
    }

    public handleRequestError(result) {
        if (result.message === 'failed to authenticate token.') {
            this.loginStatusHandler.setLoginStatus(false);
            this.router.navigateByUrl(`/login`);
        }
    }
}
