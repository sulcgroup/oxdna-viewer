/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />
const apiRoot = window.getAPIBaseURL();
/**
 * Upload structure with authentication and token refresh support
 */
async function uploadStructure() {
    const messageDiv = document.getElementById("submitstructure-message");
    messageDiv.textContent = "";
    messageDiv.classList.remove("submitstructure-success", "submitstructure-error");
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
        messageDiv.textContent = "Please log in to upload structures.";
        messageDiv.classList.add("submitstructure-error");
        view.toggleWindow("loginWindow");
        return;
    }
    // Check if token is expired (using utility from auth.ts)
    const isTokenExpired = window.isTokenExpired;
    if (isTokenExpired && isTokenExpired(token)) {
        console.log("[UploadStructure] Token expired, attempting refresh...");
        const refreshToken = window.refreshToken;
        if (refreshToken) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                messageDiv.textContent = "Session expired. Please log in again.";
                messageDiv.classList.add("submitstructure-error");
                view.toggleWindow("loginWindow");
                return;
            }
        }
        else {
            messageDiv.textContent = "Session expired. Please log in again.";
            messageDiv.classList.add("submitstructure-error");
            view.toggleWindow("loginWindow");
            return;
        }
    }
    const formData = new FormData();
    const titleInput = document.getElementById("title");
    const typeInput = document.getElementById("type");
    const descriptionInput = document.getElementById("description");
    const datePublishedInput = document.getElementById("datePublished");
    const citationInput = document.getElementById("citation");
    const paperLinkInput = document.getElementById("paperLink");
    const licensingInput = document.getElementById("licensing");
    const privateInput = document.getElementById("private");
    const keywordsInput = document.getElementById("keywords");
    // Validate required fields
    if (!titleInput.value || !typeInput.value || !descriptionInput.value ||
        !datePublishedInput.value || !licensingInput.value) {
        messageDiv.textContent = "Please fill in all required fields.";
        messageDiv.classList.add("submitstructure-error");
        return;
    }
    formData.append("title", titleInput.value);
    formData.append("type", typeInput.value);
    formData.append("description", descriptionInput.value);
    formData.append("datePublished", datePublishedInput.value);
    formData.append("citation", citationInput.value);
    formData.append("paperLink", paperLinkInput.value);
    formData.append("licensing", licensingInput.value);
    formData.append("private", privateInput.checked ? "true" : "false");
    const keywordsArray = keywordsInput.value
        .split(",")
        .map((kw) => kw.trim())
        .filter((kw) => kw !== "");
    keywordsArray.forEach((keyword) => {
        formData.append("keywords", keyword);
    });
    // Append images if any.
    const imagesInput = document.getElementById("images");
    if (imagesInput.files) {
        for (let i = 0; i < imagesInput.files.length; i++) {
            formData.append("images", imagesInput.files[i]);
        }
    }
    const submitStructureName = document.getElementById("submitStructureName");
    formData.append("files", returnOxViewJsonFile(submitStructureName.value));
    // Show uploading message
    messageDiv.textContent = "Uploading structure...";
    messageDiv.classList.remove("submitstructure-error");
    try {
        const currentToken = localStorage.getItem("token") || "";
        const response = await fetch(`${apiRoot}/structure/createStructure`, {
            method: "POST",
            credentials: "include",
            headers: {
                Authorization: "Bearer " + currentToken,
                // Do not set 'Content-Type' header when using FormData.
            },
            body: formData,
        });
        // Handle 401 with token refresh
        if (response.status === 401) {
            console.log("[UploadStructure] Got 401, attempting token refresh...");
            const refreshToken = window.refreshToken;
            if (refreshToken) {
                const refreshed = await refreshToken();
                if (refreshed) {
                    // Retry upload with new token
                    const newToken = localStorage.getItem("token") || "";
                    const retryResponse = await fetch(`${apiRoot}/structure/createStructure`, {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            Authorization: "Bearer " + newToken,
                        },
                        body: formData,
                    });
                    const retryData = await retryResponse.json();
                    if (retryResponse.ok) {
                        messageDiv.textContent =
                            retryData.message || "Structure uploaded successfully!";
                        messageDiv.classList.add("submitstructure-success");
                        // Clear form
                        document.getElementById("title").value = "";
                        document.getElementById("type").value = "";
                        document.getElementById("description").value = "";
                        document.getElementById("citation").value = "";
                        document.getElementById("paperLink").value = "";
                        document.getElementById("keywords").value = "";
                        document.getElementById("submitStructureName").value = "";
                        return;
                    }
                    else {
                        messageDiv.textContent =
                            retryData.message || "Failed to upload structure";
                        messageDiv.classList.add("submitstructure-error");
                        return;
                    }
                }
            }
            // Refresh failed, show login
            messageDiv.textContent = "Session expired. Please log in again.";
            messageDiv.classList.add("submitstructure-error");
            view.toggleWindow("loginWindow");
            return;
        }
        const data = await response.json();
        if (response.ok) {
            messageDiv.textContent =
                data.message || "Structure uploaded successfully!";
            messageDiv.classList.add("submitstructure-success");
            // Clear form on success
            document.getElementById("title").value = "";
            document.getElementById("type").value = "";
            document.getElementById("description").value = "";
            document.getElementById("citation").value = "";
            document.getElementById("paperLink").value = "";
            document.getElementById("keywords").value = "";
            document.getElementById("submitStructureName").value = "";
        }
        else {
            messageDiv.textContent =
                data.message || "Failed to upload structure";
            messageDiv.classList.add("submitstructure-error");
        }
    }
    catch (error) {
        console.error("[UploadStructure] Error uploading structure:", error);
        messageDiv.textContent = "An error occurred while uploading. Please try again.";
        messageDiv.classList.add("submitstructure-error");
    }
}
function returnOxViewJsonFile(name, space) {
    // Determine the file name
    const fileName = name && name.trim() !== "" ? `${name}.oxview` : "output.oxview";
    const content = JSON.stringify({
        date: new Date(),
        box: box.toArray(),
        systems: systems,
        forces: forceHandler.forces,
        selections: selectionListHandler.serialize(),
    }, null, space);
    return new File([content], fileName, { type: "application/json" });
}
window.uploadStructure = uploadStructure;
