/// <reference path="../../ts/typescript_definitions/oxView.d.ts" />
/// <reference path="../../ts/typescript_definitions/index.d.ts" />
interface FileEntry {
    file: File;
    description: string;
}

const fileStore: Record<string, FileEntry[]> = {
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

    const file = new File([jsonContent], "oxview_snapshot.oxview", { type: "application/json" });
    // Add snapshot with empty description so the user can provide it
    const fileEntry: FileEntry = { file, description: "" };
    fileStore.structureFiles.push(fileEntry);
    renderFileList('structureFiles');

    // Focus the newly-created description input so the user can type
    const idx = fileStore.structureFiles.length - 1;
    setTimeout(() => {
        const descInput = document.querySelector<HTMLInputElement>(`.file-desc-input[data-type="structureFiles"][data-index="${idx}"]`);
        if (descInput) descInput.focus();
    }, 50);
}


function renderFileList(type: string) {
    const listElement = document.getElementById(`${type}-list`);
    if (!listElement) return;

    listElement.innerHTML = '';
    const entries = fileStore[type] || [];
    entries.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        const descHtml = (entry.description && entry.description.trim()) ?
            `<em class="file-desc-text">${entry.description}</em>` :
            `<input type="text" class="file-desc-input" data-type="${type}" data-index="${index}" placeholder="Add description..."> <button type="button" class="button small success save-desc-btn" data-type="${type}" data-index="${index}">Save</button>`;

        listItem.innerHTML = `
            <div>
                <span class="text-bold">${entry.file.name}</span> - ${descHtml}
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

            // Try class-based selectors first (matches the markup), but fall back to searching
            // inside the same panel `.content` as the clicked button for better resilience
            let fileInput: HTMLInputElement | HTMLElement | null = document.querySelector(`.${type}-file-input`);
            let descInput: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null = document.querySelector(`.${type}-desc-input`);

            const container = (button as HTMLElement).closest('.content') || document;

            // If the class selector returned a wrapper (e.g. Metro wraps the file input in a <label>),
            // try to find the actual input inside that wrapper.
            if (fileInput && (fileInput.nodeName !== 'INPUT')) {
                const inner = (fileInput as HTMLElement).querySelector && (fileInput as HTMLElement).querySelector('input[type=file]');
                if (inner) fileInput = inner as HTMLInputElement;
            }

            // If descInput is a wrapper (div/input container), prefer the actual input/textarea inside the same panel
            if (descInput && !['INPUT', 'TEXTAREA'].includes((descInput as HTMLElement).nodeName)) {
                const innerDesc = (descInput as HTMLElement).querySelector && (descInput as HTMLElement).querySelector('input[type=text], textarea');
                if (innerDesc) descInput = innerDesc as HTMLInputElement | HTMLTextAreaElement;
            }

            // Final fallback: locate inputs inside the nearest content container
            if (!fileInput) fileInput = container.querySelector<HTMLInputElement>('input[type=file]') || null;
            if (!descInput) descInput = container.querySelector<HTMLInputElement>('input[type=text], textarea') as HTMLInputElement | HTMLTextAreaElement | null;

            if (!fileInput || !descInput) return;

            // Narrow types for TypeScript so we can access .files and .value safely
            const realFileInput = (fileInput instanceof HTMLInputElement) ? fileInput as HTMLInputElement : null;
            const realDescInput = (descInput instanceof HTMLInputElement || descInput instanceof HTMLTextAreaElement) ? descInput as HTMLInputElement | HTMLTextAreaElement : null;

            // Prefer native input.files when available, fall back to Metro plugin when present
            const metro = (window as any).Metro;
            const fileWidget = (metro && typeof metro.getPlugin === 'function') ? metro.getPlugin(realFileInput || fileInput, 'file') : null;
            let files: FileList | File[] | null = null;
            if (realFileInput && realFileInput.files && realFileInput.files.length) {
                files = realFileInput.files;
            } else if (fileWidget && fileWidget.files && fileWidget.files.length) {
                files = fileWidget.files;
            } else {
                // Final fallback: if the input exists but is a Metro-wrapped control, try searching
                // for any file input in the same container.
                const container = (button as HTMLElement).closest('.content') || document;
                const altFile = container.querySelector<HTMLInputElement>('input[type=file]');
                if (altFile && altFile.files && altFile.files.length) files = altFile.files;
            }

            // Read description value defensively - some UI wrappers may not expose a .value string
            let descRaw: any = '';
            try { descRaw = (descInput as any).value; } catch (e) { descRaw = ''; }
            if (!descRaw) {
                // try other ways to read the displayed text
                try {
                    descRaw = (descInput as any).textContent || (descInput as any).innerText || (descInput as any).getAttribute && (descInput as any).getAttribute('value') || '';
                } catch (e) { descRaw = ''; }
            }
            const descValue = (typeof descRaw === 'string') ? descRaw.trim() : '';

            // Debug info to help track problems where Metro or other UI wrappers don't expose .value
            try {
                console.debug('[upload] add-file', { type, fileInput, fileWidget: (window as any).Metro ? (window as any).Metro.getPlugin(fileInput, 'file') : null, files, descRaw, descValue });
            } catch (e) { /* ignore debug errors */ }

            if (files && files.length > 0 && descValue) {
                const description = descValue;
                const file = files[0];
                if (!fileStore[type]) fileStore[type] = [];
                fileStore[type].push({ file, description });

                renderFileList(type);

                if (fileWidget && typeof fileWidget.clear === 'function') {
                    fileWidget.clear();
                } else {
                    try { if (realFileInput) realFileInput.value = ''; } catch (e) { /* ignore */ }
                }
                try { if (realDescInput) (realDescInput as any).value = ''; } catch (e) { /* ignore */ }
            } else {
                alert("Please select a file and provide a description.");
            }
        });
    });

    // Use delegated listener and closest() to handle clicks on nested elements inside the button
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Delete button handling
        const deleteBtn = target.closest('button[data-type][data-index].alert') as HTMLButtonElement | null;
        if (deleteBtn) {
            const type = deleteBtn.dataset.type;
            const index = parseInt(deleteBtn.dataset.index || '-1', 10);
            if (type && index > -1 && Array.isArray(fileStore[type])) {
                fileStore[type].splice(index, 1);
                renderFileList(type);
            }
            return;
        }

        // Save description handling
        const saveBtn = target.closest('button.save-desc-btn') as HTMLButtonElement | null;
        if (saveBtn) {
            const type = saveBtn.dataset.type;
            const index = parseInt(saveBtn.dataset.index || '-1', 10);
            if (!type || index < 0) return;
            const input = document.querySelector<HTMLInputElement>(`.file-desc-input[data-type="${type}"][data-index="${index}"]`);
            if (!input) return;
            const val = (input.value || '').trim();
            if (!fileStore[type] || !fileStore[type][index]) return;
            fileStore[type][index].description = val;
            renderFileList(type);
            return;
        }
    });
}

async function handleUploadSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const apiRoot = window.getAPIBaseURL();

    // Build request payload explicitly and defensively
    const incoming = new FormData(form);
    const requestData: { [key: string]: any } = {};
    incoming.forEach((value, key) => {
        // For checkboxes such as 'private' we prefer to read the checked state directly
        requestData[key] = value;
    });
    const privateEl = form.querySelector<HTMLInputElement>('#private');
    if (privateEl) requestData['private'] = !!privateEl.checked;

    const formDataToSend = new FormData();
    for (const key in requestData) {
        const val = requestData[key];
        // Convert booleans/numbers to strings for FormData
        if (typeof val === 'boolean' || typeof val === 'number') {
            formDataToSend.append(key, String(val));
        } else if (val instanceof File) {
            formDataToSend.append(key, val);
        } else {
            formDataToSend.append(key, String(val));
        }
    }

    for (const type in fileStore) {
        const entries = fileStore[type] || [];
        entries.forEach(entry => {
            // Use explicit field names; keep API backwards-compatible by defaulting to original behavior
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
    const loginContainer = document.getElementById('login-container') as HTMLElement | null;
    const uploadContainer = document.getElementById('upload-container') as HTMLElement | null;

    if (!loginContainer || !uploadContainer) {
        // If expected containers are missing, fail gracefully without throwing
        console.warn('Upload window containers not present in DOM. Skipping auth UI toggle.');
        return;
    }

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
        const apiRoot = window.getAPIBaseURL();
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

