import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { StjornaCategoryModel } from '../models/category.model';
import { StjornaProductModel } from '../models/product.model';
import { StjornaService } from '../shared/stjorna.service';
import { LoginStatusHandler } from '../shared/login-handler.service';
import {StjornaServiceModel} from "../models/service.model";

@Component({
    selector: 'stjorna-categoryform',
    templateUrl: 'category-form.component.html'
})

export class CategoryFormComponent implements OnInit {
    @Input() category: StjornaCategoryModel;
    @Input() productList: Array<StjornaProductModel> = [];
    @Input() serviceList: Array<StjornaServiceModel> = [];
    @Input() isEditForm: boolean;

    public editHiddenFields = true;
    public imageChangedEvent: any = '';
    public submitted = false;

    constructor(
        private router: Router,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private loginStatusHandler: LoginStatusHandler
    ) { }

    ngOnInit() {
        if (!this.category) {
            this.category = {
                _id: null,
                name: null,
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

    public saveNewCategory(categoryForm: NgForm) {
        if (categoryForm.valid) {
            // we have to add validators for the form: min = "0" max= "1440"
            this.submitted = true;
            if (this.isEditForm) {
                this.stjornaService.saveCategory(categoryForm.value).subscribe(result => this.saveDoneAction(result));
            } else {
                this.stjornaService.saveNewCategory(categoryForm.value).subscribe(result => {
                    this.saveDoneAction(result);
                    this.router.navigateByUrl(`/dashboard/categories`);
                });
            }
        } else {
            this.toastr.warning('Form Validation', 'Your form input is not valid, please check your values.');
        }
    }

    private saveDoneAction(result) {
        this.submitted = false;
        if (result.status === 'ok' || result._id) {
            this.toastr.success('Successfully saved!');
        } else {
            this.toastr.error(result.message, 'Couldn\'t save successfully...');
        }
    }

}
