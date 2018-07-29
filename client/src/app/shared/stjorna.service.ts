import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { map, filter, catchError, mergeMap } from 'rxjs/operators';

import { HttpErrorHandler, HandleError } from './error-handler.service';
import { LoginStatusHandler } from './login-handler.service';
import { StjornaProductModel } from '../models/product.model';
import { StjornaCategoryModel } from '../models/category.model';
import { StjornaUserModel } from '../models/user.model';
import { StjornaConfigModel } from '../models/config.model';

@Injectable()
export class StjornaService {
    private host: string;
    private token: string;
    private handleError: HandleError;

    constructor(
        private http: HttpClient,
        private router: Router,
        private toastr: ToastrService,
        private httpErrorHandler: HttpErrorHandler,
        private loginStatusHandler: LoginStatusHandler
    ) {
        this.handleError = this.httpErrorHandler.createHandleError('StjornaService');
        if (window.location.hostname === 'localhost') {
            this.host = 'http://localhost:3000';
        } else {
            this.host = window.location.origin;
        }
    }

    public getProductList() {
        return this.http
            .get<StjornaProductModel[]>(`${this.host}/api/v1/products`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<StjornaProductModel[]>('load product list', [])));
    }

    public getProductById(id) {
        return this.http
            .get<StjornaProductModel>(`${this.host}/api/v1/products/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<StjornaProductModel>('load product by id')));
    }

    public saveNewProduct(product: StjornaProductModel) {
        return this.http
            .put(`${this.host}/api/v1/products`, product, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('add product')));
    }

    public saveProduct(product: StjornaProductModel) {
        return this.http
            .post(`${this.host}/api/v1/products/${product._id}`, product, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save product')));
    }

    public removeProduct(product: StjornaProductModel) {
        return this.http
            .delete(`${this.host}/api/v1/products/${product._id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('remove product')));
    }

    public getCategoryList() {
        return this.http
            .get(`${this.host}/api/v1/categories`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load category list')));
    }

    public getCategoryById(id) {
        return this.http
            .get(`${this.host}/api/v1/categories/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load category by id')));
    }

    public saveNewCategory(category: StjornaCategoryModel) {
        return this.http
            .put(`${this.host}/api/v1/categories`, category, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('add category')));
    }

    public saveCategory(category: StjornaCategoryModel) {
        return this.http
            .post(`${this.host}/api/v1/categories/${category._id}`, category, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save category')));
    }

    public removeCategory(category: StjornaCategoryModel) {
        return this.http
            .delete(`${this.host}/api/v1/categories/${category._id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('remove category')));
    }

    public getProductsByCategoryId(id) {
        return this.http
            .get(`${this.host}/api/v1/categories/${id}/products`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load products by category id')));
    }

    public getServerInfo() {
        return this.http
            .get(`${this.host}/api/v1/info/server`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load server info')));
    }

    public getServerEnvConfig() {
        return this.http
            .get(`${this.host}/api/v1/info/config`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load server env')));
    }

    public getSettings() {
        return this.http
            .get(`${this.host}/api/v1/settings`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load settings')));
    }

    public saveSettings(config: StjornaConfigModel) {
        return this.http
            .post(`${this.host}/api/v1/settings`, config, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save settings')));
    }

    public authenticateUser(user: StjornaUserModel) {
        return this.http
            .post(`${this.host}/api/v1/authenticate`, user, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('authentication error')));
    }

    public getCurrentUserApiKey(id: string) {
        return this.http
            .get(`${this.host}/api/v1/users/apikey/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load current apikey')));
    }

    public generateNewUserApiKey(id: string) {
        return this.http
            .post(`${this.host}/api/v1/users/apikey/${id}`, {}, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('gernerate new apikey')));
    }

    public getSetupDefaults() {
        return this.http
            .get(`${this.host}/api/v1/setup`)
            .pipe(catchError(this.handleError<any>('load setup defaults')));
    }

    public saveSetupConfiguration(setupConf) {
        return this.http
            .post(`${this.host}/api/v1/setup`, setupConf)
            .pipe(catchError(this.handleError<any>('save setup config')));
    }

    public verifyAuthToken() {
        let token = '';
        if (this.loginStatusHandler.getCurrentUser()) {
            token = this.loginStatusHandler.getCurrentUser().token;
        }
        return this.http
            .post<any>(`${this.host}/api/v1/authenticate/verify`, { token: token }, this.getHeaders(''))
            .pipe(catchError(this.handleError<any>('auth verify error')));
    }

    public updateUser(newPasswordObj) {
        return this.http
            .post(`${this.host}/api/v1/users/${this.loginStatusHandler.getCurrentUser()._id}`, newPasswordObj, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('update user')));
    }

    public getHost(): string {
        return this.host;
    }

    private getHeaders(token: string) {
        let userObj = this.loginStatusHandler.getCurrentUser();
        if (userObj && userObj.token) {
            return {
                headers: new HttpHeaders({
                    'Content-Type': 'application/json',
                    'x-stjorna-access-token': userObj.token,
                    'x-stjorna-userid': userObj._id,
                })
            };
        } else {
            return {
                headers: new HttpHeaders({
                    'Content-Type': 'application/json'
                })
            };
        }
    }
}
