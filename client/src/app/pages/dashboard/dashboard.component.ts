import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Config } from 'src/app/models/config';
import { StjornaService } from 'src/app/services/stjorna.service';

@Component({
    selector: 'stjorna-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    public selectedTab: String = '';
    public config$: Observable<Config>;

    constructor(private route: ActivatedRoute, private router: Router, private stjornaService: StjornaService) {
        this.route.params.subscribe(params => {
            if (params.tab) {
                this.selectedTab = params.tab;
            }
        });

        this.config$ = this.stjornaService.getSettings().pipe(
            map(r => new Config(
                r.password_secret,
                r.allow_remote_access,
                r.image,
                r.installed,
                r.modules
            ))
        );
    }

    ngOnInit() { }

    public tabChange(event) {
        this.router.navigate(['dashboard', event.nextId]);
    }
}
