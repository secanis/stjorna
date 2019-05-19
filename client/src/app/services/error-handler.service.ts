import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { LoginHandlerService } from './login-handler.service';

export type HandleError = <T> (operation?: string, result?: T) => (error: HttpErrorResponse) => Observable<T>;

@Injectable({
    providedIn: 'root'
})
export class ErrorHandlerService {

    constructor(private router: Router, private toastr: ToastrService, private loginHandlerService: LoginHandlerService) { }

    public createHandleError = (serviceName = '') =>
        <T>(operation = 'operation', result = {} as T) =>
            this.handleError(serviceName, operation, result)

    public handleError<T>(serviceName = '', operation = 'operation', result = {} as T) {
        return (error: HttpErrorResponse): Observable<T> => {
            if (error.status === 401) {
                this.loginHandlerService.setLoginStatus(false);
                this.router.navigateByUrl(`/login`);
            } else if (error.status === 403) {
                this.loginHandlerService.setLoginStatus(false);
            } else {
                if (error.error instanceof Blob) {
                    // render error log from blob
                    const reader = new FileReader();
                    reader.onload = () => {
                        this.toastr.error(JSON.parse(reader.result.toString()).message, `${serviceName}:${operation}`);
                    };
                    reader.readAsText(error.error);
                } else {
                    // handle normal errors of JSON requests
                    let message = '';
                    if (error.error) {
                        message = error.error.message;
                    } else {
                        message = error.message;
                    }
                    try {
                        this.toastr.error(message, `${serviceName}:${operation}`);
                    } catch (e) {
                        console.error(e);
                        // mostly this case is because of a lost token
                        // a logout/login helps
                    }
                }
                return of(result);
            }
        };
    }

    public handleRequestError(result) {
        if (result.message === 'failed to authenticate token.') {
            this.loginHandlerService.setLoginStatus(false);
            this.router.navigateByUrl(`/login`);
        }
    }
}
