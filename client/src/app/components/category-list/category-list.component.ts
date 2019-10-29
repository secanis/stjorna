import { Component, OnInit } from '@angular/core';
import { Category } from 'src/app/models/category';
import { Router } from '@angular/router';
import { StjornaService } from 'src/app/services/stjorna.service';
import { HelperService } from 'src/app/services/helper.service';
import { ErrorHandlerService } from 'src/app/services/error-handler.service';

@Component({
    selector: 'stjorna-category-list',
    templateUrl: './category-list.component.html',
    styleUrls: ['./category-list.component.css']
})
export class CategoryListComponent implements OnInit {
    public categoryList: Array<Category> = [];
    public search: string = '';

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private helperservice: HelperService,
        private errorHandlerService: ErrorHandlerService
    ) { }

    ngOnInit() {
        this.loadAllCategories();
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
