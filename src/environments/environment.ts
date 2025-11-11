// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // googleMapsApiKey: 'AIzaSyB7Gysu0aXgX5RT1AwTgVkOIEjAPsDE0Ik&libraries=places',
  apiUrl: 'http://localhost:3000/api',
  appAudience: 'passenger_app',
  expectedUserType: 'passenger',
  mapbox: {
  accessToken: 'pk.eyJ1Ijoicm9kYW5kb2N1YmEiLCJhIjoiY21lYzZtMWF0MWJoaDJsb2YxNG56N2NmYiJ9.o5oPXGNXcut8PE0O7CG-VA'
},
 debug: true,                     // poner en false en prod
  debugTags: ['DA', 'HTTP', 'LOC', 'PL', 'PAX']
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
