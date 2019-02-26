import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'stjorna-searchbar',
    template: `
        <div class="stjorna-searchbar">
            <input #search type="text" class="form-control" (input)="updateSearch.emit(search.value)" placeholder="{{'app.searchbar.placeholder' | translate}}">
        </div>
    `,
    styles: [`
        .stjorna-searchbar {
            margin-top: 25px;
            margin-bottom: 25px;
            padding-left: 5px;
            padding-right: 5px;
        }
    `]
})

export class SearchbarComponent implements OnInit {
    @Output() updateSearch = new EventEmitter();

    constructor() { }

    ngOnInit() {
        this.updateSearch.emit('');
    }

}
