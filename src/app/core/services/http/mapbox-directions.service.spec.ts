import { TestBed } from '@angular/core/testing';

import { MapboxDirectionsService } from './mapbox-directions.service';

describe('MapboxDirectionsService', () => {
  let service: MapboxDirectionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapboxDirectionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
