function getAPIBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:3002/api/v1";
    }
    return "https://ox.nanobase.org/api/v1";
}
async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) {
        Metro.toast.create("Email and password are required.", null, 5000, "alert");
        return;
    }
    try {
        const response = await fetch(`${getAPIBaseUrl()}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Login failed");
        }
        const data = await response.json();
        if (data.token) {
            localStorage.setItem("token", data.token);
            Metro.toast.create("Login successful!", null, 5000, "success");
            // Close the login window and refresh the view or redirect
            Metro.window.close(document.getElementById("loginWindow"));
            // Potentially refresh the library view to show user's structures
            if (typeof refreshLibraryCards === "function") {
                refreshLibraryCards();
            }
        }
        else {
            throw new Error("Token not provided");
        }
    }
    catch (error) {
        console.error("Login error:", error);
        Metro.toast.create(`Login failed: ${error.message}`, null, 5000, "alert");
    }
}
function logout() {
    localStorage.removeItem("token");
    Metro.toast.create("You have been logged out.", null, 5000, "info");
    // Potentially refresh the library view
    if (typeof refreshLibraryCards === "function") {
        refreshLibraryCards();
    }
}
function getToken() {
    return localStorage.getItem("token");
}
function isLoggedIn() {
    const token = getToken();
    if (!token)
        return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check if token is expired
        return Date.now() < payload.exp * 1000;
    }
    catch (e) {
        return false;
    }
}
window.getAPIBaseUrl = getAPIBaseUrl;
window.login = login;
window.logout = logout;
window.getToken = getToken;
window.isLoggedIn = isLoggedIn;
