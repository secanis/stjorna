import { Component, OnInit, Input } from '@angular/core';
import { Service } from 'src/app/models/service';
import { Category } from 'src/app/models/category';
import { StjornaService } from 'src/app/services/stjorna.service';
import { HelperService } from 'src/app/services/helper.service';
import { ErrorHandlerService } from 'src/app/services/error-handler.service';

@Component({
    selector: 'stjorna-service-list',
    templateUrl: './service-list.component.html',
    styleUrls: ['./service-list.component.css']
})
export class ServiceListComponent implements OnInit {
    @Input() serviceList: Array<Service> = [];
    public categoryList: Array<Category> = [];
    @Input() categoryView: Boolean = false;

    constructor(
        private stjornaService: StjornaService,
        private helperService: HelperService,
        private errorHandlerService: ErrorHandlerService
    ) { }

    ngOnInit() {
        if (!this.categoryView) {
            this.loadAllCategories();
            this.loadAllServices();
        }
    }

    private loadAllServices() {
        this.stjornaService.getServiceList().subscribe(result => this.serviceListHandler(result));
    }

    public getCategoryNameById(id: Category['_id']): string {
        let result = this.categoryList.filter((category) => {
            return category._id === id;
        });
        if (result && result[0]) {
            return result[0].name;
        }
        return '';
    }

    private serviceListHandler(result) {
        if (result && result.length > 0) {
            this.serviceList = result;
        } else {
            this.errorHandlerService.handleRequestError(result);
        }
    }

    private loadAllCategories() {
        this.stjornaService.getCategoryList().subscribe(result => this.categoryListHandler(result));
    }

    private categoryListHandler(result) {
        if (result && result.length > 0) {
            this.categoryList = result;
        } else {
            this.errorHandlerService.handleRequestError(result);
        }
    }
}
