import { Observable } from 'rxjs';
import firebase from "firebase/compat";
import {AngularFireAuth} from "@angular/fire/compat/auth";
import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root'
})
 export class AuthenticationService {
   userData: Observable<firebase.User>;
   email: string = undefined;

   constructor(private angularFireAuth: AngularFireAuth) {
     this.userData = angularFireAuth.authState;
   }

   /* Sign up */
   async SignUp(email: string, password: string) {
     await this.angularFireAuth
       .createUserWithEmailAndPassword(email, password)
   }

   /* Sign in */
   async SignIn(email: string, password: string) {
     await this.angularFireAuth
       .signInWithEmailAndPassword(email, password)
     this.email = email;
   }

   /* Sign out */
   async SignOut() {
     await this.angularFireAuth
       .signOut();
     this.email = undefined;
   }
 }
