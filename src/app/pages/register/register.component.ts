import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {AuthenticationService} from "../../../auth";

@Component({ templateUrl: 'register.component.html' })
export class RegisterComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  submitted = false;
  error: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    public authenticationService: AuthenticationService
  ) { }

  ngOnInit() {
    this.form = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  // convenience getter for easy access to form fields
  get f() { return this.form.controls; }

  async onSubmit() {
    this.submitted = true;

    // stop here if form is invalid
    if (this.form.invalid) {
      this.error = 'Invalid form';
      return;
    }

    try {
      await this.authenticationService.SignUp(this.f.username.value, this.f.password.value);
      await this.router.navigate(['/login']);
    } catch (e) {
      this.error = e;
    }
  }
}
