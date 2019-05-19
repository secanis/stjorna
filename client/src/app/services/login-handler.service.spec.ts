import { TestBed } from '@angular/core/testing';

import { LoginHandlerService } from './login-handler.service';

describe('LoginHandlerService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: LoginHandlerService = TestBed.get(LoginHandlerService);
    expect(service).toBeTruthy();
  });
});
