import { Component, OnInit } from '@angular/core';
import { Config } from 'src/app/models/config';
import { StjornaService } from 'src/app/services/stjorna.service';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'stjorna-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
    public config: Config = new Config();
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

    public triggerExport(fileType: string) {
        this.stjornaService.downloadExport(fileType).subscribe(result => this.downloadFile(result));
    }

    private loadSettings() {
        this.stjornaService.getSettings().subscribe(result => {
            this.config = new Config(
                result.password_secret,
                result.allow_remote_access,
                result.image_dimension,
                result.image_quality,
                result.installed
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

    private downloadFile(result) {
        if (result && result.headers) {
            const matches = /filename=([^;]+)/ig.exec(result.headers.get('content-disposition') || '');
            const filename = (matches[1] || 'untitled').trim();
            const data = window.URL.createObjectURL(result.body);
            const link = document.createElement('a');
            link.href = data;
            link.download = filename;
            link.click();
            setTimeout(() => {
                // For Firefox it is necessary to delay revoking the ObjectURL
                window.URL.revokeObjectURL(data);
            }, 100);
        }
    }
}
