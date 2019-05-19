import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'stjorna-searchbar',
    templateUrl: './searchbar.component.html',
    styleUrls: ['./searchbar.component.css']
})
export class SearchbarComponent implements OnInit {
    @Output() updateSearch = new EventEmitter();

    constructor() { }

    ngOnInit() {
        this.updateSearch.emit('');
    }
}
