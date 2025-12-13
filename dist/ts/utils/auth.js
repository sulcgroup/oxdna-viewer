/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />
async function login() {
    const emailField = document.getElementById("email");
    const passwordField = document.getElementById("password");
    const formData = {
        email: emailField.value,
        password: passwordField.value,
    };
    try {
        const response = await fetch(`${window.getAPIBaseURL()}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
        });
        if (response.ok) {
            const data = (await response.json());
            localStorage.setItem("token", data.token);
            console.log("User authenticated. Token stored.");
            view.toggleWindow("loginWindow");
            // view.toggleWindow("submitStructureWindow");
        }
        else {
            console.error("Authentication failed");
            alert("Authentication failed. Please check your credentials.");
        }
    }
    catch (error) {
        console.error("An error occurred:", error);
        alert("Something went wrong. Please try again later.");
    }
}
window.login = login;
