import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { StjornaCategoryModel } from '../models/category.model';
import { StjornaProductModel } from '../models/product.model';
import { StjornaService } from '../shared/stjorna.service';
import { LoginStatusHandler } from '../shared/login-handler.service';

@Component({
    selector: 'stjorna-categoryform',
    templateUrl: 'category-form.component.html'
})

export class CategoryFormComponent implements OnInit {
    @Input() category: StjornaCategoryModel;
    @Input() productList: Array<StjornaProductModel> = [];
    @Input() isEditForm: boolean;

    public editHiddenFields = true;
    public imageChangedEvent: any = '';
    public croppedImage: any = '';
    public croppedOk = false;
    public cropperImageLoaded = false;
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

    public buildImageResourceUrl(imageUrl: string): string {
        return `${this.stjornaService.getHost()}/api${imageUrl}?token=${this.loginStatusHandler.getCurrentUser().token}&userid=${this.loginStatusHandler.getCurrentUser()._id}`
    }

    public removeImage() {
        this.category.image = null;
        this.category.imageUrl = null;
        this.croppedOk = false;
        this.imageChangedEvent = '';
    }

    // image methods
    public fileChangeEvent(event: any): void {
        this.imageChangedEvent = event;
    }

    public imageCropped(image: string) {
        this.category.image = image;
    }

    public cropped(status: boolean) {
        this.croppedOk = status;
    }

    public imageLoaded() {
        this.cropperImageLoaded = true;
    }

    public loadImageFailed() {
        this.toastr.warning('Reload the page and try it again.', 'Couldn\'t load image');
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
