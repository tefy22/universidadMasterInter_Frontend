import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-page',
  imports: [ ReactiveFormsModule],
  templateUrl: './login-page.html',
})
export class LoginPage {

  router = inject(Router);
  authService = inject(Auth);
  fb = inject(FormBuilder);
  hasError = signal(false);
  isPosting = signal(false);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  onSubmit() {
    if (!this.loginForm.valid) {
      this.hasError.set(true);

      setTimeout(() => {
        this.hasError.set(false);
      }, 2000);
      return;
    }

    this.isPosting.set(true);
    this.hasError.set(false);

    this.authService.login(this.loginForm.value.email!, this.loginForm.value.password!).subscribe({
      next: (success) => {
        if (success) {
          this.router.navigateByUrl('/');
          this.isPosting.set(false);
          return;
        }

        this.hasError.set(true);
        this.isPosting.set(false);
        setTimeout(() => {
          this.hasError.set(false);
        }, 2000);
      },
      error: () => {
        this.hasError.set(true);
        this.isPosting.set(false);
        setTimeout(() => {
          this.hasError.set(false);
        }, 2000);
      }
    });
  }

}
