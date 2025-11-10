import { TestBed } from '@angular/core/testing';

import { MapboxPlacesService } from './mapbox-places.service';

describe('MapboxPlacesService', () => {
  let service: MapboxPlacesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapboxPlacesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
