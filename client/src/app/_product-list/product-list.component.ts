import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

import { StjornaProductModel } from '../models/product.model';
import { StjornaCategoryModel } from '../models/category.model';
import { StjornaService } from '../shared/stjorna.service';
import { HttpErrorHandler } from '../shared/error-handler.service';

@Component({
    selector: 'stjorna-productlist',
    templateUrl: 'product-list.component.html'
})

export class ProductListComponent implements OnInit {
    @Input() productList: Array<StjornaProductModel> = [];
    public categoryList: Array<StjornaCategoryModel> = [];
    @Input() categoryView: Boolean = false;

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private httpErrorHandler: HttpErrorHandler
    ) { }

    ngOnInit() {
        if (!this.categoryView) {
            this.loadAllCategories();
            this.loadAllProducts();
        }
    }

    private loadAllProducts() {
        this.stjornaService.getProductList().subscribe(result => this.productListHandler(result));
    }

    public getStatusElementCss(product: StjornaProductModel) {
        if (product.active) {
            return { 'fa': true, 'fa-2x': true, 'fa-check': true, 'text-success': true };
        } else {
            return { 'fa': true, 'fa-2x': true, 'fa-times': true, 'text-danger': true };
        }
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

    private productListHandler(result) {
        if (result && result.length > 0) {
            this.productList = result
        } else {
            this.httpErrorHandler.handleRequestError(result);
        }
    }

    private loadAllCategories() {
        this.stjornaService.getCategoryList().subscribe(result => this.categoryListHandler(result));
    }

    private categoryListHandler(result) {
        if (result && result.length > 0) {
            this.categoryList = result
        } else {
            this.httpErrorHandler.handleRequestError(result);
        }
    }
}
