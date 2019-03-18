import { Injectable } from '@angular/core';
import { StjornaProductModel } from '../models/product.model';

@Injectable()
export class StjornaHelperService {
    constructor() { }

    public getStatusElementCss(product: StjornaProductModel) {
        if (product.active) {
            return { 'fa': true, 'fa-2x': true, 'fa-check': true, 'text-success': true };
        } else {
            return { 'fa': true, 'fa-2x': true, 'fa-times': true, 'text-danger': true };
        }
    }

    public getImageElementCss(product: StjornaProductModel) {
        if (product.imageUrl) {
            return { 'fa': true, 'fa-2x': true, 'fa-check': true, 'text-success': true };
        } else {
            return { 'fa': true, 'fa-2x': true, 'fa-exclamation-triangle': true, 'text-warning': true };
        }
    }
    
}