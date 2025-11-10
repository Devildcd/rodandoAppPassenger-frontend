import { TestBed } from '@angular/core/testing';

import { CatalogVehiclesService } from './catalog-vehicles.service';

describe('CatalogVehiclesService', () => {
  let service: CatalogVehiclesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CatalogVehiclesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
