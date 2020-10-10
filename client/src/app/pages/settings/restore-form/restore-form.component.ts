import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { StjornaService } from 'src/app/services/stjorna.service';

@Component({
    selector: 'app-restore-form',
    template: `
    <form class="file-upload" [formGroup]="uploadForm" (submit)="importDatabase()" *ngIf="(progress$ | async) !== 100">
        <input class="form-control btn btn-sm" name="restoreFile" #file formControlName="file" (change)="onFilesAdded()" type="file" accept="application/zip">
        <button class="btn btn-sm btn-info" type="submit" [disabled]="uploadForm.invalid">
            {{'settings.import.button.zip' | translate}}
        </button>
    </form>
    <div *ngIf="(progress$ | async) as status">
        Restore status: {{status}}%
    </div>
    `,
    styles: [
        `
        .file-upload {
            display: flex;
            justify-content: space-between;
        }

        .file-upload input {
            max-width: 50%;
        }
        `
    ]
})
export class RestoreFormComponent implements OnInit {
    @ViewChild('file') file

    @Output('uploadStatus') progress$ = new EventEmitter<number>();
    uploadForm: FormGroup
    fileBinary: File;

    constructor(private stjornaService: StjornaService, private formBuilder: FormBuilder) { }

    ngOnInit(): void {
        this.uploadForm = this.formBuilder.group({
            file: new FormControl('', Validators.required),
        });
    }

    onFilesAdded() {
        const files: { [key: string]: File } = this.file.nativeElement.files;
        for (let key in files) {
            if (!isNaN(parseInt(key))) {
                this.fileBinary = files[key];
            }
        }
    }

    importDatabase() {
        this.upload(this.fileBinary);
    }

    private upload(file: File) {
        const formData: FormData = new FormData();
        formData.append('file', file, file.name);

        const req = this.stjornaService.uploadRestoreZip(formData)

        req.subscribe(event => {
            if (event.type === HttpEventType.UploadProgress) {
                const percentDone = Math.round(100 * event.loaded / event.total);
                this.progress$.next(percentDone);
            } else if (event instanceof HttpResponse) {
                this.progress$.complete();
            }
        });
    }

}
