import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

import { StjornaCategoryModel } from '../models/category.model';
import { StjornaService } from '../shared/stjorna.service';
import { HttpErrorHandler } from '../shared/error-handler.service';
import {StjornaServiceModel} from "../models/service.model";
import { StjornaHelperService } from '../shared/helper.service';

@Component({
    selector: 'stjorna-servicelist',
    templateUrl: 'service-list.component.html'
})

export class ServiceListComponent implements OnInit {
    @Input() serviceList: Array<StjornaServiceModel> = [];
    public categoryList: Array<StjornaCategoryModel> = [];
    @Input() categoryView: Boolean = false;

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private stjornaHelperService: StjornaHelperService,
        private httpErrorHandler: HttpErrorHandler
    ) { }

    ngOnInit() {
        if (!this.categoryView) {
            this.loadAllCategories();
            this.loadAllServices();
        }
    }

    private loadAllServices() {
        this.stjornaService.getServiceList().subscribe(result => this.serviceListHandler(result));
    }

    public getCategoryNameById(id: StjornaCategoryModel['_id']): string {
        let result = this.categoryList.filter((category) => {
            return category._id === id;
        });
        if (result && result[0]) {
            return result[0].name;
        }
        return '';
    }

    private serviceListHandler(result) {
        if (result && result.length > 0) {
            this.serviceList = result;
        } else {
            this.httpErrorHandler.handleRequestError(result);
        }
    }

    private loadAllCategories() {
        this.stjornaService.getCategoryList().subscribe(result => this.categoryListHandler(result));
    }

    private categoryListHandler(result) {
        if (result && result.length > 0) {
            this.categoryList = result;
        } else {
            this.httpErrorHandler.handleRequestError(result);
        }
    }
}
