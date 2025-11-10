import { Routes } from "@angular/router";

import DriverArrivingComponent from "./trip-driver-arriving/driver-arriving.component";
import PassengerOnTripComponent from "./passenger-on-trip/passenger-on-trip.component";



export default [
    {
        path: 'driver-arriving', component: DriverArrivingComponent
    },
    {
        path: 'passenger-on-trip', component: PassengerOnTripComponent
    },
    {
        path: '', redirectTo: 'driver-arriving', pathMatch: 'full'
    }
] as Routes
