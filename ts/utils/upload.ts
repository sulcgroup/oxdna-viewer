/// <reference path="../../ts/typescript_definitions/oxView.d.ts" />
/// <reference path="../../ts/typescript_definitions/index.d.ts" />
interface FileEntry {
    file: File;
    description: string;
}

const fileStore: { [key: string]: FileEntry[] } = {
    images: [],
    structureFiles: [],
    simProtFiles: [],
    simResFiles: [],
    expProtFiles: [],
    expResFiles: [],
};

function createOxViewFileContent(): string {
    try {
        const data = {
            date: new Date(),
            box: box.toArray(),
            systems,
            forces: forceHandler.forces,
            selections: selectionListHandler.serialize(),
        };
        return JSON.stringify(data, null, 2);
    } catch (e) {
        console.error("Could not create oxView file content. Are you in a scene?", e);
        alert("Could not create oxView file content. Please ensure you are in a scene view.");
        return "";
    }
}

function prepopulateOxViewSnapshot() {
    const jsonContent = createOxViewFileContent();
    if (!jsonContent) return;

    const file = new File([jsonContent], "oxview_snapshot.json", { type: "application/json" });
    const fileEntry: FileEntry = { file, description: "oxView Snapshot of current scene" };

    fileStore.structureFiles.push(fileEntry);
    renderFileList('structureFiles');
}


function renderFileList(type: string) {
    const listElement = document.getElementById(`${type}-list`);
    if (!listElement) return;

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
            const type = (button as HTMLElement).dataset.type;
            if (!type) return;

            const fileInput = document.querySelector<HTMLInputElement>(`.${type}-file-input`);
            const descInput = document.querySelector<HTMLInputElement>(`.${type}-desc-input`);

            if (fileInput && fileInput.files && fileInput.files.length > 0 && descInput && descInput.value) {
                const description = descInput.value;
                const file = fileInput.files[0];
                fileStore[type].push({ file, description });

                renderFileList(type);
                fileInput.value = ''; // Clear the input
                descInput.value = '';
            } else {
                alert("Please select a file and provide a description.");
            }
        });
    });

    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
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

async function handleUploadSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const apiRoot = "https://api.nanobase.org/api/v1"; // Using nanobase.org as a placeholder

    const requestData: { [key: string]: any } = {};
    formData.forEach((value, key) => {
        if (key === 'private') {
            requestData[key] = (form.querySelector('#private') as HTMLInputElement).checked;
        } else {
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
    } catch (error) {
        console.error("Upload failed:", error);
        alert('An error occurred during upload: ' + (error as Error).message);
    }
}

function checkAuth() {
    console.log("hehere?")
    const loginContainer = document.getElementById('login-container') as HTMLElement;
    const uploadContainer = document.getElementById('upload-container') as HTMLElement;

    if (isTokenValid()) {
        loginContainer.style.display = 'none';
        uploadContainer.style.display = 'block';
    } else {
        loginContainer.style.display = 'block';
        uploadContainer.style.display = 'none';
    }
}

function decode(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Invalid token format", e);
        return null;
    }
}

/**
 * Returns true if a token exists in localStorage and is not expired.
 */
function isTokenValid(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const decodedToken = decode(token);
        if (!decodedToken || !decodedToken.exp) {
            return false;
        }
        // exp is in seconds, Date.now() is in milliseconds
        return Date.now() < decodedToken.exp * 1000;
    } catch (e) {
        console.error("Token validation failed", e);
        return false;
    }
}

async function handleLogin(e: Event) {
    e.preventDefault();
    const email = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;

    if (email && password) {
        const apiRoot = "https://api.nanobase.org/api/v1";
        const formData = { email, password };

        try {
            const response = await fetch(`${apiRoot}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem("token", data.token);
                checkAuth();
            }
        } catch (error) {
            console.error(error);
        }
    }
}

function initUploadWindow() {
    setupFileInputs();
    document.getElementById('snapshot-btn')?.addEventListener('click', prepopulateOxViewSnapshot);
    document.getElementById('upload-form')?.addEventListener('submit', handleUploadSubmit);
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    checkAuth();
}

