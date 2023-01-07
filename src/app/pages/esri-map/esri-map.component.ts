/*
  Copyright 2019 Esri
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {loadModules, setDefaultOptions} from 'esri-loader';
import {Subscription} from "rxjs";
import {FirebaseService, ITestItem} from "src/app/services/database/firebase";
import {AuthenticationService} from "../../../auth";
import {Router} from "@angular/router"; // Esri TypeScript Types
import esri = __esri;

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"]
})
export class EsriMapComponent implements OnInit, OnDestroy {
  // The <div> where we will place the map
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  // register Dojo AMD dependencies
  _Map;
  _MapView;
  _FeatureLayer;
  _Graphic;
  _GraphicsLayer;
  _Route;
  _RouteParameters;
  _FeatureSet;
  _Point;
  _locator;

  // Instances
  map: any;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;

  // Attributes
  zoom = 10;
  center: Array<number> = [44.439663, 26.096306];
  basemap = "streets-vector";
  loaded = false;
  pointCoords: number[] = [-118.73682450024377, 34.07817583063242];
  dir: number = 0;
  count: number = 0;
  timeoutHandler = null;
  lastSearchedPoint: any = undefined;

  // firebase sync
  isConnected: boolean = false;
  subscriptionList: Subscription;
  subscriptionSearch: Subscription;
  subscriptionObj: Subscription;
  originPoint: any = undefined;
  destinationPoint: any = undefined;
  email: string;

  constructor(
    private fbs: FirebaseService,
    public authenticationService: AuthenticationService,
    private router: Router,
  ) {
    this.email = this.authenticationService.email;
    this.email = this.email.replace('.', '_');
  }

  async initializeMap() {
    try {
      // configure esri-loader to use version x from the ArcGIS CDN
      // setDefaultOptions({ version: '3.3.0', css: true });
      setDefaultOptions({ css: true });

      // Load the modules for the ArcGIS API for JavaScript
      const [esriConfig, Map, MapView, FeatureLayer, Graphic, Point, GraphicsLayer, route, RouteParameters, FeatureSet, Track, Search, Locate] = await loadModules([
        "esri/config",
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/Graphic",
        "esri/geometry/Point",
        "esri/layers/GraphicsLayer",
        "esri/rest/route",
        "esri/rest/support/RouteParameters",
        "esri/rest/support/FeatureSet",
        "esri/widgets/Track",
        "esri/widgets/Search",
        "esri/widgets/Locate"
      ]);

      esriConfig.apiKey = "AAPK4895c8305fb6470e93b2e541f088febdKAZV1yCSvZSUCoTTbkKtUMMJGk620REJ8gd47X_xXuHxpoHTwM_gSa-0RkvY4-46";

      this._Map = Map;
      this._MapView = MapView;
      this._FeatureLayer = FeatureLayer;
      this._Graphic = Graphic;
      this._GraphicsLayer = GraphicsLayer;
      this._Route = route;
      this._RouteParameters = RouteParameters;
      this._FeatureSet = FeatureSet;
      this._Point = Point;

      // Configure the Map
      const mapProperties = {
        basemap: this.basemap
      };

      this.map = new Map(mapProperties);

      this.addFeatureLayers();
      this.addGraphicLayers();

     // this.addPoint(this.pointCoords[1], this.pointCoords[0], true);

      // Initialize the MapView
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map
      };

      this.view = new MapView(mapViewProperties);

      // Fires `pointer-move` event when user clicks on "Shift"
      // key and moves the pointer on the view.
      this.view.on('pointer-move', ["Shift"], (event) => {
        let point = this.view.toMap({ x: event.x, y: event.y });
      });

      const weakThis = this;
      const track = new Track({
        view: this.view,
        graphic: new Graphic({
          symbol: {
            type: "simple-marker",
            color: "white",
            size: "20px"
          }
        }),
        visible: false,
        useHeadingEnabled: false,
        goToLocationEnabled: true,
        goToOverride: function(view, options) {
          weakThis.originPoint = options.target.target;
          weakThis.graphicsLayer.removeAll();
          weakThis.addGraphic("origin", weakThis.originPoint);
          if (weakThis.destinationPoint !== undefined) {
            weakThis.addGraphic("destination", weakThis.destinationPoint);
            weakThis.getRoute();
          }
          return view.goTo(options.target);
        }
      });
      const search = new Search({  //Add Search widget
        view: this.view,
        goToOverride: function(view, options) {
          weakThis.destinationPoint = options.target.target.geometry.centroid;

          weakThis.fbs.addLastSearch(weakThis.email, weakThis.destinationPoint.latitude, weakThis.destinationPoint.longitude);

          weakThis.graphicsLayer.removeAll();
          weakThis.addGraphic("destination", weakThis.destinationPoint);

          if (weakThis.originPoint !== undefined) {
            weakThis.addGraphic("origin", weakThis.originPoint);
            weakThis.getRoute();
          }
          return view.goTo(options.target);
        }
      });
      const locate = new Locate({
        view: this.view,
        useHeadingEnabled: false,
      });
      this.view.ui.add(locate, "top-left");
      this.view.ui.add(search, "top-right");
      this.view.ui.add(track, "top-left");
      await this.view.when(() => {track.start();}); // wait for map to load
      return this.view;
    } catch (error) {
      console.log("EsriLoader: ", error);
    }
  }
  routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

  getRoute() {
    const routeParams = new this._RouteParameters({
      stops: new this._FeatureSet({
        features: this.graphicsLayer.graphics.toArray()
      }),
      returnDirections: true
    });

    this._Route.solve(this.routeUrl, routeParams).then((data: any) => {
      for (let result of data.routeResults) {
        result.route.symbol = {
          type: "simple-line",
          color: [5, 150, 255],
          width: 3
        };
        this.graphicsLayer.add(result.route);
      }

      // Display directions
      if (data.routeResults.length > 0) {
        const directions: any = document.createElement("ol");
        directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
        directions.style.marginTop = "0";
        directions.style.padding = "15px 15px 15px 30px";
        const features = data.routeResults[0].directions.features;

        // Show each direction
        const direction = document.createElement("div");
        direction.innerHTML = features[2].attributes.text + " (" + Math.floor(1609.34 * features[2].attributes.length) + " meters)";
        directions.appendChild(direction);

        let sumLength = 0;
        let sumTime = 0;
        // Show each direction
        features.forEach((result: any, i: any) => {
          sumLength += parseFloat(result.attributes.length);
          sumTime += parseFloat(result.attributes.time);
        });

        const lengthtime = document.createElement("div");
        lengthtime.innerHTML = Math.floor(1.60934 * sumLength * 100) / 100 + " km, " + Math.floor(sumTime) + " min";
        directions.appendChild(lengthtime);

        this.view.ui.empty("bottom-right");
        this.view.ui.add(directions, "bottom-right");

      }

    }).catch((error: any) => {
      console.log(error);
    });
  }
  addGraphic(type, point) {
    const graphic = new this._Graphic({
      symbol: {
        type: "simple-marker",
        color: (type === "origin") ? "white" : "black",
        size: "20px"
      },
      geometry: point
    });
    this.graphicsLayer.add(graphic);
  }
  addGraphicLayers() {
    this.graphicsLayer = new this._GraphicsLayer();
    this.map.add(this.graphicsLayer);
  }

  addFeatureLayers() {
    // Trailheads feature layer (points)
    var fogLayer: __esri.FeatureLayer = new this._FeatureLayer({
      url:
        "https://services9.arcgis.com/uAyDtlCBvwXRl10Y/arcgis/rest/services/Accidente_Romania/FeatureServer"
    });

    this.map.add(fogLayer);
  }

  async logOut() {
    await this.authenticationService.SignOut();
    await this.router.navigate(['/login']);
  }

  addPoint(lat: number, lng: number, register: boolean) {
    const point = { //Create a point
      type: "point",
      longitude: lng,
      latitude: lat
    };
    const simpleMarkerSymbol = {
      type: "simple-marker",
      color: "blue",
      outline: {
        color: "blue", // White
        width: 1
      }
    };
    let pointGraphic: esri.Graphic = new this._Graphic({
      geometry: point,
      symbol: simpleMarkerSymbol
    });

    this.view.graphics.add(pointGraphic);
  }

  addLastSearchPoint() {
    const lat = this.lastSearchedPoint.lat;
    const lng = this.lastSearchedPoint.lng;
    if (lat === undefined || lng === undefined) {
      return;
    }
    this.destinationPoint = {
      type: "point",
      longitude: lng,
      latitude: lat
    };

    this.graphicsLayer.removeAll();
    this.addGraphic("destination", this.destinationPoint);

    if (this.originPoint !== undefined) {
      this.addGraphic("origin", this.originPoint);
      console.log(this.destinationPoint)
      console.log(this.originPoint)

      this.getRoute();
    }
  }

  removePoint() {
    if (this.pointGraphic != null) {
      this.graphicsLayer.remove(this.pointGraphic);
    }
  }

  runTimer() {
    this.timeoutHandler = setTimeout(() => {
      // code to execute continuously until the view is closed
      // ...
      this.animatePointDemo();
      this.runTimer();
    }, 200);
  }

  animatePointDemo() {
    this.removePoint();
    switch (this.dir) {
      case 0:
        this.pointCoords[1] += 0.01;
        break;
      case 1:
        this.pointCoords[0] += 0.02;
        break;
      case 2:
        this.pointCoords[1] -= 0.01;
        break;
      case 3:
        this.pointCoords[0] -= 0.02;
        break;
    }

    this.count += 1;
    if (this.count >= 10) {
      this.count = 0;
      this.dir += 1;
      if (this.dir > 3) {
        this.dir = 0;
      }
    }

  //  this.addPoint(this.pointCoords[1], this.pointCoords[0], true);
    this.fbs.syncPointItem(this.pointCoords[1], this.pointCoords[0]);
  }

  stopTimer() {
    if (this.timeoutHandler != null) {
      clearTimeout(this.timeoutHandler);
      this.timeoutHandler = null;
    }
  }

  printLastSearch() {
    if (this.lastSearchedPoint?.lat === undefined) {
      return 'No last searches';
    }
    return 'Last search: ' + this.lastSearchedPoint.lat + ', ' + this.lastSearchedPoint.lng;
  }

  connectFirebase() {
    if (this.isConnected) {
      return;
    }
    this.isConnected = true;
    this.fbs.connectToDatabase();
    console.log("Connected to firebase");
    this.subscriptionList = this.fbs.getChangeFeedList().subscribe((items: ITestItem[]) => {
      this.view.graphics.removeAll();
      for (let item of items) {
        this.addPoint(item.lat, item.lng, false);
      }
    });
    this.subscriptionSearch = this.fbs.getChangeSearchFeed(this.email).subscribe((item: any) => {
       this.lastSearchedPoint = {
         lat: item[0].lat,
         lng: item[0].lng,
       };
    });
  }

  addPointItem() {
    this.fbs.addPointItem(this.originPoint.latitude, this.originPoint.longitude);
  }

  disconnectFirebase() {
    if (this.subscriptionList != null) {
      this.subscriptionList.unsubscribe();
    }
    if (this.subscriptionSearch != null) {
      this.subscriptionSearch.unsubscribe();
    }
    if (this.subscriptionObj != null) {
      this.subscriptionObj.unsubscribe();
    }
  }

  ngOnInit() {
    // Initialize MapView and return an instance of MapView
    this.initializeMap().then(() => {
      this.connectFirebase();
      // The map has been initialized
      this.loaded = this.view.ready;
    });
  }

  ngOnDestroy() {
    if (this.view) {
      // destroy the map view
      this.view.container = null;
    }
    this.stopTimer();
    this.disconnectFirebase();
  }
}
