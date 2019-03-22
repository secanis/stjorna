import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { StjornaProductModel } from '../models/product.model';
import { StjornaCategoryModel } from '../models/category.model';
import { StjornaService } from '../shared/stjorna.service';
import { LoginStatusHandler } from '../shared/login-handler.service';
import { HttpErrorHandler } from '../shared/error-handler.service';

@Component({
    selector: 'stjorna-productform',
    templateUrl: 'product-form.component.html'
})

export class ProductFormComponent implements OnInit {
    @Input() product: StjornaProductModel;
    @Input() isEditForm: boolean;

    public categoryList: Array<StjornaCategoryModel> = [];
    public editHiddenFields = true;
    public submitted = false;

    constructor(
        private router: Router,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private httpErrorHandler: HttpErrorHandler,
        private loginStatusHandler: LoginStatusHandler
    ) { }

    ngOnInit() {
        this.loadAllCategories();
        if (!this.product) {
            this.product = {
                _id: null,
                name: null,
                category: null,
                price: 0,
                description: null,
                active: true,
                image: null,
                imageUrl: null,
                created: null,
                createdUser: null,
                updated: null,
                updatedUser: null,
            };
        }

        if (this.isEditForm) {
            this.editHiddenFields = true;
        } else {
            this.editHiddenFields = false;
        }
    }

    public saveProduct(productForm: NgForm) {
        if (productForm.valid) {
            // we have to add validators for the form: min = "0" max= "1440"
            this.submitted = true;
            if (this.isEditForm) {
                this.stjornaService.saveProduct(productForm.value).subscribe(result => this.saveDoneAction(result));
            } else {
                this.stjornaService.saveNewProduct(productForm.value).subscribe(result => {
                    this.saveDoneAction(result);
                    this.router.navigateByUrl(`/dashboard/products`);
                });
            }
        } else {
            this.toastr.warning('Form Validation', 'Your form input is not valid, please check your values.');
        }
    }

    private saveDoneAction(result) {
        this.submitted = false;
        if (result && result._id) {
            this.toastr.success('Successfully saved!');
        } else {
            this.toastr.error(result.message, 'Couldn\'t save successfully...');
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
