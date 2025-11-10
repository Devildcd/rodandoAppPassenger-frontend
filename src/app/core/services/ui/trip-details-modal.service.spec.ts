import { TestBed } from '@angular/core/testing';

import { TripDetailsModalService } from './trip-details-modal.service';

describe('TripDetailsModalService', () => {
  let service: TripDetailsModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TripDetailsModalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
