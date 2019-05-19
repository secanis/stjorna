import { Component, OnInit, Input } from '@angular/core';
import { Service } from 'src/app/models/service';
import { Category } from 'src/app/models/category';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { StjornaService } from 'src/app/services/stjorna.service';
import { ErrorHandlerService } from 'src/app/services/error-handler.service';
import { NgForm } from '@angular/forms';

@Component({
    selector: 'stjorna-service-form',
    templateUrl: './service-form.component.html',
    styleUrls: ['./service-form.component.css']
})
export class ServiceFormComponent implements OnInit {
    @Input() service: Service;
    @Input() isEditForm: boolean;

    public categoryList: Array<Category> = [];
    public editHiddenFields = true;
    public submitted = false;

    constructor(
        private router: Router,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private errorHandlerService: ErrorHandlerService,
    ) { }

    ngOnInit() {
        this.loadAllCategories();
        if (!this.service) {
            this.service = {
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

    public saveService(serviceForm: NgForm) {
        if (serviceForm.valid) {
            // we have to add validators for the form: min = "0" max= "1440"
            this.submitted = true;
            if (this.isEditForm) {
                this.stjornaService.saveService(serviceForm.value).subscribe(result => this.saveDoneAction(result));
            } else {
                this.stjornaService.saveNewService(serviceForm.value).subscribe(result => {
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
            this.errorHandlerService.handleRequestError(result);
        }
    }
}
