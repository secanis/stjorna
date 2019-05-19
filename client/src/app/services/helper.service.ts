import { Injectable } from '@angular/core';
import { Product } from '../models/product';

@Injectable({
    providedIn: 'root'
})
export class HelperService {

    constructor() { }

    public getStatusElementCss(product: Product) {
        if (product.active) {
            return { 'lnr': true, 'lnr-2x': true, 'lnr-checkmark-circle': true, 'text-success': true };
        } else {
            return { 'lnr': true, 'lnr-2x': true, 'lnr-lock': true, 'text-danger': true };
        }
    }

    public getImageElementCss(product: Product) {
        if (product.imageUrl) {
            return { 'lnr': true, 'lnr-2x': true, 'lnr-checkmark-circle': true, 'text-success': true };
        } else {
            return { 'lnr': true, 'lnr-2x': true, 'lnr-warning': true, 'text-warning': true };
        }
    }
}
