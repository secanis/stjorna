import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class TranslateService {
    public data: any = {};
    private activeLang: string = '';

    constructor(private http: HttpClient) { }

    use(lang: string): Promise<{}> {
        return new Promise<{}>((resolve, reject) => {
            const givenLang = lang || 'en';
            const langPath = `assets/i18n/${givenLang}.json`;
            if (this.activeLang !== givenLang && this.data !== {}) {
                this.http.get<{}>(langPath).subscribe(
                    translation => {
                        this.data = Object.assign({}, translation || {});
                        this.activeLang = givenLang;
                        resolve(this.data);
                    },
                    error => {
                        this.data = {};
                        resolve(this.data);
                    }
                );
            } else {
                // nothing changed, do not load lang package
            }
        });
    }
}