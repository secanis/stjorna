import { Component, OnInit, Input } from '@angular/core';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { Service } from 'src/app/models/service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { StjornaService } from 'src/app/services/stjorna.service';
import { NgForm } from '@angular/forms';

@Component({
    selector: 'stjorna-category-form',
    templateUrl: './category-form.component.html',
    styleUrls: ['./category-form.component.css']
})
export class CategoryFormComponent implements OnInit {
    @Input() category: Category;
    @Input() productList: Array<Product> = [];
    @Input() serviceList: Array<Service> = [];
    @Input() isEditForm: boolean;

    public editHiddenFields = true;
    public imageChangedEvent: any = '';
    public submitted = false;

    constructor(
        private router: Router,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
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
