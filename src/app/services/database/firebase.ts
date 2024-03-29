import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';

export interface ITestItem {
    name: string,
    lat: number,
    lng: number
}

@Injectable()
export class FirebaseService {

    listFeed: Observable<any[]>;
    objFeed: Observable<any>;

    constructor(public db: AngularFireDatabase) {

    }

    connectToDatabase() {
        this.listFeed = this.db.list('list').valueChanges();
        this.objFeed = this.db.object('obj').valueChanges();
    }

    getChangeFeedList() {
        return this.listFeed;
    }

    getChangeFeedObj() {
        return this.objFeed;
    }
    getChangeSearchFeed(email: string) {
        return this.db.object(email).valueChanges();
    }

    addPointItem(lat: number, lng: number) {
        let item: ITestItem = {
            name: "police",
            lat: lat,
            lng: lng
        };
        this.db.list('list').push(item);
    }

    addLastSearch(email: string, lat: number, lng: number) {
      let item = {
        name: "search",
        lat: lat,
        lng: lng
      };
      this.db.object(email).set([item]);
    }

    syncPointItem(lat: number, lng: number) {
        let item: ITestItem = {
            name: "test",
            lat: lat,
            lng: lng
        };
        this.db.object('obj').set([item]);
    }
}
