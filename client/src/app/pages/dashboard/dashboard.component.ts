import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    selector: 'stjorna-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    public selectedTab: String = '';

    constructor(private route: ActivatedRoute, private router: Router) {
        this.route.params.subscribe(params => {
            if (params.tab) {
                this.selectedTab = params.tab;
            }
        });
    }

    ngOnInit() { }

    public tabChange(event) {
        this.router.navigate(['dashboard', event.nextId]);
    }
}
