import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoginHandlerService } from 'src/app/services/login-handler.service';

@Component({
    selector: 'stjorna-logout',
    templateUrl: './logout.component.html',
    styleUrls: ['./logout.component.css']
})
export class LogoutComponent implements OnInit {
    constructor(private router: Router, private loginHandlerStatus: LoginHandlerService) { }

    ngOnInit() { }

    public logoutUser() {
        // let user = JSON.parse(localStorage.getItem('currentUser')).token;
        localStorage.removeItem('currentUser');
        this.loginHandlerStatus.setLoginStatus(false);
        this.router.navigateByUrl('/login');
    }
}
