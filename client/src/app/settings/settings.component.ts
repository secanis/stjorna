import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

import { StjornaConfigModel } from '../models/config.model';
import { StjornaService } from '../shared/stjorna.service';

@Component({
    selector: 'stjorna-settings',
    templateUrl: 'settings.component.html'
})

export class SettingsComponent implements OnInit {
    public config: StjornaConfigModel = new StjornaConfigModel();
    public configEnv: Array<any> = [];

    constructor(private stjornaService: StjornaService, private toastr: ToastrService) { }

    ngOnInit() {
        this.loadSettings();
    }

    public saveSettings(config) {
        this.stjornaService.saveSettings(config).subscribe(result => this.saveDoneAction(result));
    }

    public buildExampleUrl(): string {
        return `${location.origin}/api/v1/products?apikey=<%APIKEY%>&userid=<%USERID%>`;
    }

    private loadSettings() {
        this.stjornaService.getSettings().subscribe(result => {
            this.config = new StjornaConfigModel(
                result.password_secret,
                result.allow_remote_access,
                result.image_dimension,
                result.image_quality
            );
        });
        this.stjornaService.getServerEnvConfig().subscribe(result => this.configEnv = result);
    }

    private saveDoneAction(result) {
        if (result.status === 'ok') {
            this.toastr.success('Successfully saved!');
        } else {
            this.toastr.error(result.message, 'Couldn\'t save successfully...');
        }
    }
}
