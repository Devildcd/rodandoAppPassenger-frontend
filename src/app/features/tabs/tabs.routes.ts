import TripComponent from "@/app/pages/trip/trip.component";
import HomeComponent from "./home/home.component";
import MapComponent from "./map/map.component";
import EarningsComponent from "./earnings/earnings.component";
import { Routes } from "@angular/router";

export default [
    {
        path: 'home', component: HomeComponent
    },
    {
        path: 'map', component: MapComponent
    },
    {
        path: 'trips', component: TripComponent
    },
    {
        path: 'earnings', component: EarningsComponent
    },
    {
        path: '', redirectTo: 'home', pathMatch: 'full'
    }
] as Routes
