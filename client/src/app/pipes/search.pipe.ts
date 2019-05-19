import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'search',
    pure: false
})
export class SearchPipe implements PipeTransform {
    transform(value: Array<any>, searchText) {
        if (searchText !== undefined) {
            searchText = searchText.toLocaleLowerCase();
        } else {
            searchText = '';
        }

        if (value) {
            return value.filter(item => {
                let result = false;
                if (item !== null) {
                    if (item !== undefined && typeof item === 'string' && item.toLocaleLowerCase().includes(searchText)) { result = true; }
                    if (item.name !== undefined && item.name.toLocaleLowerCase().includes(searchText)) { result = true; }
                }
                return result;
            });
        }
    }
}
