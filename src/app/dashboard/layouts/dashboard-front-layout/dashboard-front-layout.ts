import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from "../../components/navbar/navbar";

@Component({
  selector: 'app-dashboard-front-layout',
  imports: [RouterOutlet, Navbar],
  templateUrl: './dashboard-front-layout.html',
})
export class DashboardFrontLayout {



}
