import { Component, OnInit, Input, SimpleChanges, OnChanges } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { StjornaService } from 'src/app/services/stjorna.service';
import { LoginHandlerService } from 'src/app/services/login-handler.service';
import { ImageCroppedEvent } from 'ngx-image-cropper';
import { Config } from 'src/app/models/config';

@Component({
    selector: 'stjorna-image-cropper',
    templateUrl: './image-cropper.component.html',
    styleUrls: ['./image-cropper.component.css']
})
export class ImageCropperComponent implements OnInit, OnChanges {
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
    public config: Config;

    constructor (
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private loginHandlerService: LoginHandlerService
    ) { }

    ngOnInit() {
        this.stjornaService.getSettings().subscribe((data) => {
            this.config = data;
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        this.element = changes.element.currentValue;
    }

    public buildImageResourceUrl(imageUrl: string): string {
        return `${this.stjornaService.getHost()}/api${imageUrl}?token=${this.loginHandlerService.getCurrentUser().token}&userid=${this.loginHandlerService.getCurrentUser()._id}`;
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

    public imageCropped(image: ImageCroppedEvent) {
        console.log(image);
        this.element[this.imageSelector] = image.base64;
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
