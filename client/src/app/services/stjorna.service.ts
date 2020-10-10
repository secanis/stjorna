import { Injectable } from '@angular/core';
import { HandleError, ErrorHandlerService } from './error-handler.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { LoginHandlerService } from './login-handler.service';
import { Product } from '../models/product';
import { Service } from '../models/service';
import { Category } from '../models/category';
import { Config } from '../models/config';
import { User } from '../models/user';
import { environment } from 'src/environments/environment';
import { FormGroup } from '@angular/forms';

@Injectable({
    providedIn: 'root'
})
export class StjornaService {
    private token: string;
    private handleError: HandleError;

    constructor(
        private http: HttpClient,
        private errorHandlerService: ErrorHandlerService,
        private loginHandlerService: LoginHandlerService
    ) {
        this.handleError = this.errorHandlerService.createHandleError('StjornaService');
    }

    public getProductList() {
        return this.http
            .get<Product[]>(`${environment.apiUrl}/api/v1/products`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<Product[]>('load product list', [])));
    }

    public getProductById(id) {
        return this.http
            .get<Product>(`${environment.apiUrl}/api/v1/products/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<Product>('load product by id')));
    }

    public saveNewProduct(product: Product) {
        return this.http
            .put(`${environment.apiUrl}/api/v1/products`, product, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('add product')));
    }

    public saveProduct(product: Product) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/products/${product._id}`, product, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save product')));
    }

    public removeProduct(product: Product) {
        return this.http
            .delete(`${environment.apiUrl}/api/v1/products/${product._id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('remove product')));
    }

    public getServiceList() {
        return this.http
            .get<Service[]>(`${environment.apiUrl}/api/v1/services`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<Service[]>('load service list', [])));
    }

    public getServiceById(id) {
        return this.http
            .get<Service>(`${environment.apiUrl}/api/v1/services/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<Service>('load service by id')));
    }

    public saveNewService(service: Service) {
        return this.http
            .put(`${environment.apiUrl}/api/v1/services`, service, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('add service')));
    }

    public saveService(service: Service) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/services/${service._id}`, service, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save service')));
    }

    public removeService(service: Service) {
        return this.http
            .delete(`${environment.apiUrl}/api/v1/services/${service._id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('remove service')));
    }

    public getCategoryList() {
        return this.http
            .get(`${environment.apiUrl}/api/v1/categories`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load category list')));
    }

    public getCategoryById(id) {
        return this.http
            .get(`${environment.apiUrl}/api/v1/categories/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load category by id')));
    }

    public saveNewCategory(category: Category) {
        return this.http
            .put(`${environment.apiUrl}/api/v1/categories`, category, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('add category')));
    }

    public saveCategory(category: Category) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/categories/${category._id}`, category, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save category')));
    }

    public removeCategory(category: Category) {
        return this.http
            .delete(`${environment.apiUrl}/api/v1/categories/${category._id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('remove category')));
    }

    public getProductsByCategoryId(id) {
        return this.http
            .get(`${environment.apiUrl}/api/v1/categories/${id}/products`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load products by category id')));
    }

    public getServicesByCategoryId(id) {
        return this.http
            .get(`${environment.apiUrl}/api/v1/categories/${id}/services`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load services by category id')));
    }

    public getServerInfo() {
        return this.http
            .get(`${environment.apiUrl}/api/v1/info/server`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load server info')));
    }

    public getServerEnvConfig() {
        return this.http
            .get(`${environment.apiUrl}/api/v1/info/config`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load server env')));
    }

    public getCronjobState() {
        return this.http
            .get(`${environment.apiUrl}/api/v1/state/cron`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load cronjob state')));
    }

    public getSettings() {
        return this.http
            .get(`${environment.apiUrl}/api/v1/settings`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load settings')));
    }

    public saveSettings(config: Config) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/settings`, config, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('save settings')));
    }

    public authenticateUser(user: User) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/authenticate`, user, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('authentication error')));
    }

    public getCurrentUserApiKey(id: string) {
        return this.http
            .get(`${environment.apiUrl}/api/v1/users/apikey/${id}`, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('load current apikey')));
    }

    public generateNewUserApiKey(id: string) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/users/apikey/${id}`, {}, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('gernerate new apikey')));
    }

    public getSetupDefaults() {
        return this.http
            .get(`${environment.apiUrl}/api/v1/setup`)
            .pipe(catchError(this.handleError<any>('load setup defaults')));
    }

    public saveSetupConfiguration(setupConf) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/setup`, setupConf)
            .pipe(catchError(this.handleError<any>('save setup config')));
    }

    public verifyAuthToken() {
        let token = '';
        if (this.loginHandlerService.getCurrentUser()) {
            token = this.loginHandlerService.getCurrentUser().token;
        }
        return this.http
            .post<any>(`${environment.apiUrl}/api/v1/authenticate/verify`, { token: token }, this.getHeaders(''))
            .pipe(catchError(this.handleError<any>('auth verify error')));
    }

    public updateUser(newPasswordObj) {
        return this.http
            .post(`${environment.apiUrl}/api/v1/users/${this.loginHandlerService.getCurrentUser()._id}`,
                newPasswordObj, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('update user')));
    }

    public getHost(): string {
        return environment.apiUrl;
    }

    public downloadExport(fileType: string) {
        return this.http
            .get(`${environment.apiUrl}/api/v1/export/${fileType}`, {
                responseType: 'blob',
                observe: 'response', headers: this.getHeaders(this.token).headers
            })
            .pipe(catchError(this.handleError<any>(`download export ${fileType}`)));
    }

    public resetDatabase() {
        return this.http.post(`${environment.apiUrl}/api/v1/reset`, null, this.getHeaders(this.token))
            .pipe(catchError(this.handleError<any>('reset database')));
    }

    public uploadRestoreZip(formData: FormData) {
        let headers = this.getHeaders(this.token).headers;
        headers = headers.delete('content-type');

        return this.http.post(`${environment.apiUrl}/api/v1/restore`, formData, { headers, reportProgress: true, observe: 'events' })
            .pipe(catchError(this.handleError<any>('upload restore zip')));
    }

    private getHeaders(token: string) {
        const userObj = this.loginHandlerService.getCurrentUser();
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
