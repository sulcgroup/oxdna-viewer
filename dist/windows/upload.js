/// <reference path="../ts/typescript_definitions/oxView.d.ts" />
/// <reference path="../ts/typescript_definitions/index.d.ts" />
const fileStore = {
    images: [],
    structureFiles: [],
    simProtFiles: [],
    simResFiles: [],
    expProtFiles: [],
    expResFiles: [],
};
function createOxViewFileContent() {
    try {
        const data = {
            date: new Date(),
            box: box.toArray(),
            systems,
            forces: forceHandler.forces,
            selections: selectionListHandler.serialize(),
        };
        return JSON.stringify(data, null, 2);
    }
    catch (e) {
        console.error("Could not create oxView file content. Are you in a scene?", e);
        alert("Could not create oxView file content. Please ensure you are in a scene view.");
        return "";
    }
}
function prepopulateOxViewSnapshot() {
    const jsonContent = createOxViewFileContent();
    if (!jsonContent)
        return;
    const file = new File([jsonContent], "oxview_snapshot.oxview", { type: "application/json" });
    const fileEntry = { file, description: "oxView Snapshot of current scene" };
    fileStore.structureFiles.push(fileEntry);
    renderFileList('structureFiles');
}
function renderFileList(type) {
    const listElement = document.getElementById(`${type}-list`);
    if (!listElement)
        return;
    listElement.innerHTML = '';
    fileStore[type].forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        listItem.innerHTML = `
            <div>
                <span class="text-bold">${entry.file.name}</span> - <em>${entry.description}</em>
            </div>
            <button type="button" class="button alert small" data-type="${type}" data-index="${index}">Delete</button>
        `;
        listElement.appendChild(listItem);
    });
}
function setupFileInputs() {
    document.querySelectorAll('.add-file-btn').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.type;
            if (!type)
                return;
            const fileInput = document.querySelector(`.${type}-file-input`);
            const descInput = document.querySelector(`.${type}-desc-input`);
            if (fileInput && fileInput.files && fileInput.files.length > 0 && descInput) {
                const description = descInput.value || 'No description';
                const file = fileInput.files[0];
                fileStore[type].push({ file, description });
                renderFileList(type);
                fileInput.value = ''; // Clear the input
                descInput.value = '';
            }
            else {
                alert("Please select a file and provide a description.");
            }
        });
    });
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('button') && target.dataset.type && target.dataset.index) {
            const type = target.dataset.type;
            const index = parseInt(target.dataset.index || '-1', 10);
            if (type && index > -1) {
                fileStore[type].splice(index, 1);
                renderFileList(type);
            }
        }
    });
}
async function handleUploadSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const apiRoot = "https://nanobase.org/api"; // Using nanobase.org as a placeholder
    const requestData = {};
    formData.forEach((value, key) => {
        if (key === 'private') {
            requestData[key] = form.querySelector('#private').checked;
        }
        else {
            requestData[key] = value;
        }
    });
    const formDataToSend = new FormData();
    for (const key in requestData) {
        formDataToSend.append(key, requestData[key]);
    }
    for (const type in fileStore) {
        fileStore[type].forEach(entry => {
            formDataToSend.append(type, entry.file);
            formDataToSend.append(`${type}Description`, entry.description);
        });
    }
    try {
        const token = localStorage.getItem('token');
        // Use a dummy token when none is available to satisfy the API header
        const authHeader = `Bearer ${token || 'dummy-token'}`;
        const response = await fetch(`${apiRoot}/structure/createStructure`, {
            method: "POST",
            headers: {
                Authorization: authHeader,
            },
            body: formDataToSend,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to upload structure.' }));
            throw new Error(errorData.message);
        }
        const result = await response.json();
        alert('Structure uploaded successfully! ' + (result.message || ''));
    }
    catch (error) {
        console.error("Upload failed:", error);
        alert('An error occurred during upload: ' + error.message);
    }
}
function checkAuth() {
    const loginContainer = document.getElementById('login-container');
    const uploadContainer = document.getElementById('upload-container');
    if (isTokenValid()) {
        loginContainer.style.display = 'none';
        uploadContainer.style.display = 'block';
    }
    else {
        loginContainer.style.display = 'block';
        uploadContainer.style.display = 'none';
    }
}
/**
 * Returns true if a token exists in localStorage and is not expired.
 */
function isTokenValid() {
    const token = localStorage.getItem('token');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (!token || !tokenExpiry)
        return false;
    const expiryNum = parseInt(tokenExpiry, 10);
    if (Number.isNaN(expiryNum))
        return false;
    return Date.now() < expiryNum;
}
async function handleLogin(e) {
    e.preventDefault();
    // Dummy login logic
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (email && password) {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        const dummyToken = 'dummy-token-' + new Date().getTime();
        const expiryTime = new Date().getTime() + (60 * 60 * 1000); // 1 hour expiry
        localStorage.setItem('token', dummyToken);
        localStorage.setItem('tokenExpiry', expiryTime.toString());
        checkAuth();
    }
    else {
        alert('Please enter email and password.');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    setupFileInputs();
    document.getElementById('snapshot-btn')?.addEventListener('click', prepopulateOxViewSnapshot);
    document.getElementById('upload-form')?.addEventListener('submit', handleUploadSubmit);
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    checkAuth();
});
