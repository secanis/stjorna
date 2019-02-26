import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { StjornaConfigModel } from '../models/config.model';
import { StjornaUserModel } from '../models/user.model';
import { StjornaService } from '../shared/stjorna.service';
import { LoginStatusHandler } from '../shared/login-handler.service';

@Component({
    selector: 'stjorna-setup',
    templateUrl: 'setup.component.html'
})

export class SetupComponent implements OnInit {
    public completedSetup = false;
    public config: StjornaConfigModel = new StjornaConfigModel();
    public user: StjornaUserModel = {
        _id: '',
        username: '',
        password: '',
        email: '',
        token: '',
        language: ''
    };

    constructor(
        private router: Router,
        private stjornaService: StjornaService,
        private loginStatusHandler: LoginStatusHandler
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
            return {'fa-check': true, 'text-success': true};
        } else {
            return {'fa-times': true, 'text-danger': true};
        }
    }

    private loadSettingDefaults() {
        this.stjornaService.getSetupDefaults().subscribe(result => {
            if (result && result.message === 'installation done' && result.status === 'ok') {
                this.router.navigate(['dashboard']);
            }
            this.config = new StjornaConfigModel(
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
