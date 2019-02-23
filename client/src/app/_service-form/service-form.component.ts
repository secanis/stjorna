import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { StjornaServiceModel } from '../models/service.model';
import { StjornaCategoryModel } from '../models/category.model';
import { StjornaService } from '../shared/stjorna.service';
import { LoginStatusHandler } from '../shared/login-handler.service';
import { HttpErrorHandler } from '../shared/error-handler.service';

@Component({
    selector: 'stjorna-serviceform',
    templateUrl: 'service-form.component.html'
})

export class ServiceFormComponent implements OnInit {
    @Input() service: StjornaServiceModel;
    @Input() isEditForm: boolean;

    public categoryList: Array<StjornaCategoryModel> = [];
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
        private httpErrorHandler: HttpErrorHandler,
        private loginStatusHandler: LoginStatusHandler
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

    public buildImageResourceUrl(imageUrl: string): string {
        return `${this.stjornaService.getHost()}/api${imageUrl}?token=${this.loginStatusHandler.getCurrentUser().token}&userid=${this.loginStatusHandler.getCurrentUser()._id}`;
    }

    public removeImage() {
        this.service.image = null;
        this.service.imageUrl = null;
        this.croppedOk = false;
        this.imageChangedEvent = '';
    }

    // image methods
    public fileChangeEvent(event: any): void {
        this.imageChangedEvent = event;
    }

    public imageCropped(image: string) {
        this.service.image = image;
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
