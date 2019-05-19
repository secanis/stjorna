import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { StjornaService } from 'src/app/services/stjorna.service';
import { TranslateService } from 'src/app/services/translate.service';
import { LoginHandlerService } from 'src/app/services/login-handler.service';
import * as clipboard from 'clipboard';

@Component({
    selector: 'stjorna-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
    public currentUser;
    public currentUserApiKey: string;

    constructor(
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private toastr: ToastrService,
        private stjornaService: StjornaService,
        private translateService: TranslateService,
        private loginHandlerService: LoginHandlerService
    ) { }

    ngOnInit() {
        if (!this.activatedRoute.snapshot.params.username) {
            this.router.navigate([`/profile/${this.loginHandlerService.getCurrentUser()._id}`]);
        }
        this.currentUser = this.loginHandlerService.getCurrentUser();
        this.currentUser.password = null;
        this.loadCurrentUserApiKey();
        // initial load clipboard service
        new clipboard('.btn-copy-cb');
    }

    public saveProfile(profileForm) {
        if (profileForm.valid) {
            if (profileForm.value.password && profileForm.value.email && profileForm.value.language) {
                this.stjornaService.updateUser(profileForm.value).subscribe(result => this.saveDoneAction(result));
                // reset user and prepare to save the date to localstorage
                this.currentUser.password = null;
                this.currentUser.passwordNew = null;
                this.currentUser.passwordNewRepeat = null;
                this.translateService.use(this.currentUser.language);
            } else {
                this.toastr.warning('Please type your password to save.', 'Validation Error');
            }
        } else if (profileForm.value.passwordNew && !profileForm.value.password) {
            this.toastr.warning('Please type your password to save.', 'Validation Error');
        } else {
            this.toastr.warning('Please check your input values.', 'Validation Error');
        }
    }

    public generateApiKey() {
        this.stjornaService.generateNewUserApiKey(this.currentUser._id).subscribe(result => {
            if (result && result.apikey) {
                this.currentUserApiKey = result.apikey;
                this.toastr.success('Successfully generated API Key');
            }
        });
    }

    private loadCurrentUserApiKey() {
        this.stjornaService.getCurrentUserApiKey(this.currentUser._id).subscribe(result => this.currentUserApiKey = result.apikey);
    }

    private saveDoneAction(result) {
        if (result) {
            this.loginHandlerService.setCurrentUser(result);
            this.currentUser = this.loginHandlerService.getCurrentUser();
            this.toastr.success('Successfully saved!');
        } else {
            this.currentUser = this.loginHandlerService.getCurrentUser();
        }
    }
}
