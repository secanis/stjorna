import { Component } from '@angular/core';
import { Config } from 'src/app/models/config';
import { StjornaService } from 'src/app/services/stjorna.service';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoginHandlerService } from 'src/app/services/login-handler.service';

@Component({
    selector: 'stjorna-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
    public config$: Observable<Config> = this.stjornaService.getSettings().pipe(
        map(r => new Config(
            r.password_secret,
            r.allow_remote_access,
            r.image,
            r.installed,
            r.modules
        ))
    );

    public configEnv$: Observable<Array<any>> = this.stjornaService.getServerEnvConfig();
    cronjobInfo$: Observable<any> = this.stjornaService.getCronjobState();

    constructor(private stjornaService: StjornaService, private toastr: ToastrService,
        private router: Router, private loginHandlerService: LoginHandlerService) { }

    public saveSettings(config) {
        this.stjornaService.saveSettings(config).subscribe(result => this.saveDoneAction(result));
    }

    public buildExampleUrl(): string {
        return `${location.origin}/api/v1/products?apikey=<%APIKEY%>&userid=<%USERID%>`;
    }

    public triggerExport(fileType: string) {
        this.stjornaService.downloadExport(fileType).subscribe(result => this.downloadFile(result));
    }

    public triggerDataReset() {
        if (confirm(`Are you sure you want to reset COMPLETE Stjorna database?`)) {
            this.stjornaService.resetDatabase().subscribe(_ => {
                this.loginHandlerService.setLoginStatus(false);
                this.router.navigate(['setup']);
            });
        }
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
