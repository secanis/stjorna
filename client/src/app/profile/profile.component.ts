import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import * as clipboard from 'clipboard';

import { StjornaService } from '../shared/stjorna.service';
import { StjornaUserModel } from '../models/user.model';
import { LoginStatusHandler } from '../shared/login-handler.service';

@Component({
    selector: 'stjorna-profile',
    templateUrl: 'profile.component.html'
})

export class ProfileComponent implements OnInit {
    public currentUser;
    public currentUserApiKey: string;

    constructor(
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private loginStatusHandler: LoginStatusHandler
    ) { }

    ngOnInit() {
        if (!this.activatedRoute.snapshot.params.username) {
            this.router.navigate([`/profile/${this.loginStatusHandler.getCurrentUser()._id}`]);
        }
        this.currentUser = this.loginStatusHandler.getCurrentUser();
        this.currentUser.password = null;
        this.loadCurrentUserApiKey();
        // initial load clipboard service
        new clipboard('.btn-copy-cb');
    }

    public saveProfile(profileForm) {
        if (profileForm.valid) {
            if (profileForm.value.password && profileForm.value.email) {
                this.stjornaService.updateUser(profileForm.value).subscribe(result => this.saveDoneAction(result));
                // reset user and prepare to save the date to localstorage
                this.currentUser.password = null;
                this.currentUser.passwordNew = null;
                this.currentUser.passwordNewRepeat = null;
            }
        } else if (!profileForm.value.password) {
            this.toastr.warning('Please type your password to save.', 'Validation Error');
        } else {
            this.toastr.warning('Please check your input values.', 'Validation Error');
        }
    }

    public generateApiKey() {
        this.stjornaService.generateNewUserApiKey(this.currentUser._id).subscribe(result => {
            if (result && result.message === "successfully updated") {
                this.currentUserApiKey = result.apikey;
                this.toastr.success('Successfully generated API Key');
                this.loadCurrentUserApiKey();
            }
        });
    }

    private loadCurrentUserApiKey() {
        this.stjornaService.getCurrentUserApiKey(this.currentUser._id).subscribe(result => this.currentUserApiKey = result.apikey);
    }

    private saveDoneAction(result) {
        if (result.status === "ok") {
            this.loginStatusHandler.setCurrentUser(result);
            this.currentUser = this.loginStatusHandler.getCurrentUser();
            this.toastr.success('Successfully saved!');
        } else {
            this.currentUser = this.loginStatusHandler.getCurrentUser();
        }
    }
}
