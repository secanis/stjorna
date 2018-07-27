import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { StjornaProductModel } from '../models/product.model';
import { StjornaCategoryModel } from '../models/category.model';
import { StjornaService } from '../shared/stjorna.service';

@Component({
    selector: 'stjorna-product',
    templateUrl: 'view-product.component.html'
})

export class ViewProductComponent implements OnInit {
    public currentRoute: string;
    public product: StjornaProductModel;
    public category: StjornaCategoryModel;
    private params;

    constructor(private router: Router, private activatedRoute: ActivatedRoute, private stjornaService: StjornaService, private toastr: ToastrService) { }

    ngOnInit() {
        this.currentRoute = this.router.url;
        let currentId = this.activatedRoute.snapshot.params.id;
        if (this.currentRoute.includes('product')) {
            this.loadExistingProduct(currentId);
        }
        if (this.currentRoute.includes('category')) {
            this.loadExistingCategory(currentId);
        }
    }

    // methods for products
    public removeProduct(product: StjornaProductModel) {
        if (confirm(`Are you sure you want to delete ${product.name}?`)) {
            this.stjornaService.removeProduct(product).subscribe(result => {
                if (result.message) {
                    this.toastr.info(`Deleted Successfully!`);
                    this.redirectToDashboard('product');
                }
            });
        }
    }

    private loadExistingProduct(id) {
        this.stjornaService.getProductById(id).subscribe(result => this.product = result);
    }

    // methods for categories
    public removeCategory(category: StjornaCategoryModel) {
        if (confirm(`Are you sure you want to delete ${category.name}?`)) {
            this.stjornaService.removeCategory(category).subscribe(result => {
                console.log(result);
                if (result.status === 'warning') {
                    this.toastr.warning(result.message);
                } else if (result.message) {
                    this.toastr.info(`Deleted Successfully!`);
                    this.redirectToDashboard('categories');
                }
            });
        }
    }

    private loadExistingCategory(id) {
        this.stjornaService.getCategoryById(id).subscribe(result => this.category = result);
    }

    // helper methods
    private redirectToDashboard(param: string) {
        this.router.navigateByUrl(`/dashboard/${param}`);
    }
}
