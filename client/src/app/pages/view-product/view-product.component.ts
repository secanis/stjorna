import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { StjornaService } from 'src/app/services/stjorna.service';
import { Product } from 'src/app/models/product';
import { Service } from 'src/app/models/service';
import { Category } from 'src/app/models/category';

@Component({
    selector: 'stjorna-view-product',
    templateUrl: './view-product.component.html',
    styleUrls: ['./view-product.component.css']
})
export class ViewProductComponent implements OnInit {
    public currentRoute: string;
    public product: Product;
    public productList: Array<Product> = [];
    public service: Service;
    public serviceList: Array<Service> = [];
    public category: Category;

    constructor(private router: Router, private activatedRoute: ActivatedRoute, private stjornaService: StjornaService, private toastr: ToastrService) { }

    ngOnInit() {
        this.currentRoute = this.router.url;
        let currentId = this.activatedRoute.snapshot.params.id;
        if (this.currentRoute.includes('product')) {
            this.loadExistingProduct(currentId);
        }
        if (this.currentRoute.includes('service')) {
            this.loadExistingService(currentId);
        }
        if (this.currentRoute.includes('category')) {
            this.loadExistingCategory(currentId);
            this.loadProductsByCategory(currentId);
            this.loadServicesByCategory(currentId);
        }
    }

    // methods for products
    public removeProduct(product: Product) {
        if (confirm(`Are you sure you want to delete ${product.name}?`)) {
            this.stjornaService.removeProduct(product).subscribe(result => {
                if (result.message) {
                    this.toastr.info(`Deleted Successfully!`);
                    this.redirectToDashboard('product');
                }
            });
        }
    }

    private loadExistingService(id) {
        this.stjornaService.getServiceById(id).subscribe(result => this.service = result);
    }

    private loadExistingProduct(id) {
        this.stjornaService.getProductById(id).subscribe(result => this.product = result);
    }

    // methods for categories
    public removeCategory(category: Category) {
        if (confirm(`Are you sure you want to delete ${category.name}?`)) {
            this.stjornaService.removeCategory(category).subscribe(result => {
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

    private loadProductsByCategory(id) {
        this.stjornaService.getProductsByCategoryId(id).subscribe(result => this.productList = result);
    }

    private loadServicesByCategory(id) {
        this.stjornaService.getServicesByCategoryId(id).subscribe(result => this.serviceList = result);
    }

    // helper methods
    private redirectToDashboard(param: string) {
        this.router.navigateByUrl(`/dashboard/${param}`);
    }
}
