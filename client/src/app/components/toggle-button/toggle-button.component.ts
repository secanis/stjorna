import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-toggle-button',
    template: `
    <label class="switch">
        <input type="checkbox" [checked]="checked" (change)="triggerEmit(!checked)">
        <span class="slider round"></span>
    </label>
  `,
    styles: [
        `
        .switch {
            position: relative;
            display: inline-block;
            width: 54px;
            height: 28px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
        }

        input:checked + .slider {
            background-color: #2196F3;
        }

        input:focus + .slider {
            box-shadow: 0 0 1px #2196F3;
        }

        input:checked + .slider:before {
            transform: translateX(26px);
        }

        .slider.round {
            border-radius: 34px;
        }

        .slider.round:before {
            border-radius: 50%;
        }
        `
    ]
})
export class ToggleButtonComponent {
    @Input() checked: boolean;
    @Output() stateChanged = new EventEmitter();

    constructor() { }

    triggerEmit(state: boolean) {
        this.stateChanged.next(state);
    }
}
