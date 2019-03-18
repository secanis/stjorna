import { Component } from '@angular/core';

@Component({
    selector: 'stjorna-spinner',
    template: `
        <div class="loader-wrapper">
            <div class="loader"></div>
            <div class="loader-label">
                <h5>
                {{'spinner.processing.image.title' | translate}}
                </h5>
                <h5>
                    <small>{{'spinner.processing.image.description' | translate}}</small>
                </h5>
            </div>
        </div>
    `,
    styles: [`
        .loader-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 9999;
        }

        .loader {
            margin: 40vh auto auto;
            width: 150px;
            border: 8px solid #333;
            border-top: 8px solid #f0f0f0;
            border-radius: 50%;
            width: 120px;
            height: 120px;
            animation: spin 1s linear infinite;
        }

        .loader-label h5 {
            padding-top: 30px;
            color: white;
            font-weight: bold;
            text-align: center;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `]
})

export class SpinnerComponent {
    constructor() { }
}
