import { Component, Input, SimpleChanges } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

import { StjornaService } from '../shared/stjorna.service';
import { LoginStatusHandler } from '../shared/login-handler.service';

@Component({
    selector: 'stjorna-image-cropper',
    templateUrl: 'image-cropper.component.html'
})

/**
 * The ImageCropperComponent allows to implement the cropper component in an easy way to reduce
 * duplicated code in every from component.
 * @Example <stjorna-image-cropper [(element)]="service" [description]="'service image'"></stjorna-image-cropper>
 */
export class ImageCropperComponent {
    /**
     * element {any} You can pass an object, this object must have the imageSelector attributes
     * or the image/imageUrl attribute.
     */
    @Input() element;
    /**
     * description {string} Optional description to describe the image it self.
     */
    @Input() description: string;
    /**
     * imageSelector {string} If you have other than the image selector you can pass your
     * own image fields, image is the temporary base64 image.
     */
    @Input() imageSelector: string = 'image';
    /**
     * imageUrlSelector {string} If you have an other than the imageUrl selector you can pass your
     * own imageUrl field, imageUrl is the path of your image.
     */
    @Input() imageUrlSelector: string = 'imageUrl';

    public imageChangedEvent: any = '';
    public croppedOk = false;
    public cropperImageLoaded = false;

    constructor(
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private loginStatusHandler: LoginStatusHandler
    ) { }

    ngOnChanges(changes: SimpleChanges) {
        this.element = changes.element.currentValue;
    }

    public buildImageResourceUrl(imageUrl: string): string {
        return `${this.stjornaService.getHost()}/api${imageUrl}?token=${this.loginStatusHandler.getCurrentUser().token}&userid=${this.loginStatusHandler.getCurrentUser()._id}`;
    }

    public removeImage() {
        this.element[this.imageSelector] = '';
        this.element[this.imageUrlSelector] = '';
        this.croppedOk = false;
        this.imageChangedEvent = '';
    }

    public fileChangeEvent(event: any): void {
        this.imageChangedEvent = event;
    }

    public imageCropped(image: string) {
        this.element[this.imageSelector] = image;
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
    
}
