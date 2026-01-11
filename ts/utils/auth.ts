/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

interface LoginResponse {
  token: string;
  encryptionKey?: string;
  keyExpiresAt?: number;
  expiresIn?: number;
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch {
    return true; // If we can't decode, assume expired
  }
}

/**
 * Get encryption key from localStorage with expiration check
 */
function getEncryptionKey(): string | null {
  try {
    const stored = localStorage.getItem('enc_key_data');
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Check expiration (24 hours)
    if (Date.now() >= data.expiresAt) {
      console.warn('[Auth] Encryption key expired');
      localStorage.removeItem('enc_key_data');
      return null;
    }

    return data.key;
  } catch {
    return null;
  }
}

/**
 * Refresh access token using refresh token cookie
 */
async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${window.getAPIBaseURL()}/refresh`, {
      method: "POST",
      credentials: "include", // Send refresh token cookie
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const newToken = data.accessToken || data.token;
      localStorage.setItem("token", newToken);
      console.log("[Auth] Token refreshed successfully");
      return true;
    } else {
      console.error("[Auth] Token refresh failed");
      return false;
    }
  } catch (error) {
    console.error("[Auth] Token refresh error:", error);
    return false;
  }
}

/**
 * Login function with encryption key storage and improved error handling
 */
async function login() {
  const emailField = document.getElementById(
    "email",
  ) as HTMLInputElement | null;
  const passwordField = document.getElementById(
    "password",
  ) as HTMLInputElement | null;

  if (!emailField || !passwordField) {
    alert("Login form fields not found.");
    return;
  }

  const formData = {
    email: emailField.value,
    password: passwordField.value,
  };

  // Basic client-side validation
  if (!formData.email || !formData.password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    const response = await fetch(`${window.getAPIBaseURL()}/auth/login`, {
      method: "POST",
      credentials: "include", // Important for refresh token cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const data = (await response.json()) as LoginResponse;

      // Store JWT token
      localStorage.setItem("token", data.token);
      console.log("[Auth] User authenticated. Token stored.");

      // Store encryption key with 24-hour expiration (if provided)
      if (data.encryptionKey && data.keyExpiresAt) {
        localStorage.setItem('enc_key_data', JSON.stringify({
          key: data.encryptionKey,
          expiresAt: data.keyExpiresAt
        }));
        console.log("[Auth] Encryption key stored with expiration:", new Date(data.keyExpiresAt));
      } else {
        console.warn("[Auth] No encryption key in login response - encrypted features may not work");
      }

      view.toggleWindow("loginWindow");
      // view.toggleWindow("submitStructureWindow");
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error("[Auth] Authentication failed:", errorData);

      // Show specific error messages based on status code
      let errorMessage = "Authentication failed. ";
      if (response.status === 401) {
        errorMessage += "Invalid email or password.";
      } else if (response.status === 429) {
        errorMessage += "Too many login attempts. Please try again later.";
      } else if (errorData.message) {
        errorMessage += errorData.message;
      } else {
        errorMessage += "Please check your credentials and try again.";
      }

      alert(errorMessage);
    }
  } catch (error) {
    console.error("[Auth] Login error:", error);
    alert("Unable to connect to the server. Please check your internet connection and try again.");
  }
}

// Export functions to window for global access
(window as any).login = login;
(window as any).isTokenExpired = isTokenExpired;
(window as any).getEncryptionKey = getEncryptionKey;
(window as any).refreshToken = refreshToken;