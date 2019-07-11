import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StjornaService } from 'src/app/services/stjorna.service';
import { Config } from 'src/app/models/config';
import { User } from 'src/app/models/user';

@Component({
    selector: 'stjorna-setup',
    templateUrl: './setup.component.html',
    styleUrls: ['./setup.component.css']
})
export class SetupComponent implements OnInit {
    public completedSetup = false;
    public config: Config = new Config();
    public user: User = {
        _id: '',
        username: '',
        password: '',
        email: '',
        token: '',
        language: ''
    };

    constructor(
        private router: Router,
        private stjornaService: StjornaService
    ) { }

    ngOnInit() {
        this.loadSettingDefaults();
    }

    public completeSetup(user, config) {
        this.stjornaService.saveSetupConfiguration({
            config: config,
            user: user
        }).subscribe(result => this.saveDoneAction(result));
    }

    public getIconClass(statusObj, attribute) {
        if (statusObj && statusObj.message && statusObj.message[attribute]
            && statusObj.message[attribute].status === 'ok') {
            return { 'lnr-checkmark-circle': true, 'text-success': true };
        } else {
            return { 'lnr-warning': true, 'text-danger': true };
        }
    }

    private loadSettingDefaults() {
        this.stjornaService.getSetupDefaults().subscribe(result => {
            if (result && result.message === 'installation done' && result.status === 'ok') {
                this.router.navigate(['dashboard']);
            }
            this.config = new Config(
                '',
                result.allow_remote_access,
                result.image_dimension,
                result.image_quality,
                result.installed
            );
        });
    }

    private saveDoneAction(result) {
        this.completedSetup = result;
    }
}