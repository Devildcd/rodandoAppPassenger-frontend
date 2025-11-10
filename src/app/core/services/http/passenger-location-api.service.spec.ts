import { TestBed } from '@angular/core/testing';

import { PassengerLocationApiService } from './passenger-location-api.service';

describe('PassengerLocationApiService', () => {
  let service: PassengerLocationApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PassengerLocationApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
