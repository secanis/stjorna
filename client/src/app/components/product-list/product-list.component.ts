import { Component, OnInit, Input } from '@angular/core';
import { StjornaService } from 'src/app/services/stjorna.service';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { HelperService } from 'src/app/services/helper.service';
import { ErrorHandlerService } from 'src/app/services/error-handler.service';

@Component({
    selector: 'stjorna-product-list',
    templateUrl: './product-list.component.html',
    styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit {
    @Input() productList: Array<Product> = [];
    public categoryList: Array<Category> = [];
    @Input() categoryView: Boolean = false;
    public search: string = '';

    constructor(
        private stjornaService: StjornaService,
        private helperService: HelperService,
        private errorHandlerService: ErrorHandlerService
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

    public getCategoryNameById(id: Category['_id']): string {
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
            this.productList = result;
        } else {
            this.errorHandlerService.handleRequestError(result);
        }
    }

    private loadAllCategories() {
        this.stjornaService.getCategoryList().subscribe(result => this.categoryListHandler(result));
    }

    private categoryListHandler(result) {
        if (result && result.length > 0) {
            this.categoryList = result;
        } else {
            this.errorHandlerService.handleRequestError(result);
        }
    }
}
