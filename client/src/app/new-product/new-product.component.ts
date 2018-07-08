import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { StjornaProductModel } from '../models/product.model';
import { StjornaService } from '../shared/stjorna.service';

@Component({
    selector: 'stjorna-product',
    templateUrl: 'new-product.component.html'
})

export class NewProductComponent implements OnInit {
    public currentRoute: string;

    constructor(private router: Router, private stjornaService: StjornaService) { }

    ngOnInit() {
        this.currentRoute = this.router.url;
    }
}
