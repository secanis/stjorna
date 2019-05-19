import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StjornaService } from 'src/app/services/stjorna.service';

@Component({
    selector: 'stjorna-new-product',
    templateUrl: './new-product.component.html',
    styleUrls: ['./new-product.component.css']
})
export class NewProductComponent implements OnInit {
    public currentRoute: string;

    constructor(private router: Router, private stjornaService: StjornaService) { }

    ngOnInit() {
        this.currentRoute = this.router.url;
    }

}
