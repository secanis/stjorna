import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { StjornaCategoryModel } from '../models/category.model';
import { StjornaService } from '../shared/stjorna.service';
import { HttpErrorHandler } from '../shared/error-handler.service';

@Component({
    selector: 'stjorna-categorylist',
    templateUrl: 'category-list.component.html'
})

export class CategoryListComponent implements OnInit {
    public categoryList: Array<StjornaCategoryModel> = [];

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private httpErrorHandler: HttpErrorHandler
    ) { }

    ngOnInit() {
        this.loadAllCategories();
    }

    private loadAllCategories() {
        this.stjornaService.getCategoryList().subscribe(result => this.categoryListHandler(result));
    }

    public getStatusElementCss(category: StjornaCategoryModel) {
        if (category.active) {
            return { 'fa': true, 'fa-2x': true, 'fa-check': true, 'text-success': true };
        } else {
            return { 'fa': true, 'fa-2x': true, 'fa-times': true, 'text-danger': true };
        }
    }

    private categoryListHandler(result) {
        if (result && result.length > 0) {
            this.categoryList = result;
        } else {
            this.httpErrorHandler.handleRequestError(result);
        }
    }
}
