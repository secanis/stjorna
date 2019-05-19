import { Component, OnInit } from '@angular/core';
import { StjornaService } from 'src/app/services/stjorna.service';

@Component({
    selector: 'stjorna-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit {
    public serverInfo;

    constructor(private stjornaService: StjornaService) { }

    ngOnInit() {
        this.loadServerInfo();
    }

    private loadServerInfo() {
        this.stjornaService.getServerInfo().subscribe(result => this.serverInfo = result);
    }
}
