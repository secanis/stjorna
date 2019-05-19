import { TestBed } from '@angular/core/testing';

import { StjornaService } from './stjorna.service';

describe('StjornaService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: StjornaService = TestBed.get(StjornaService);
    expect(service).toBeTruthy();
  });
});
