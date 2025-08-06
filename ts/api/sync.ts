/// <reference path="../typescript_definitions/oxView.d.ts" />

function getAuthHeader() {
    const token = getToken();
    if (!token) return {};
    return { "Authorization": `Bearer ${token}` };
}

async function getRemoteStructures(): Promise<StructureSummary[]> {
    if (!isLoggedIn()) return [];

    try {
        const response = await fetch(`${getAPIBaseUrl()}/oxview/structures`, {
            headers: getAuthHeader(),
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error("Failed to fetch structures");
        }
        const data = await response.json();
        return data.structures;
    } catch (error) {
        console.error("getRemoteStructures error:", error);
        return [];
    }
}

async function getRemoteStructureDetails(id: string): Promise<OxViewStructure | null> {
    if (!isLoggedIn()) return null;

    try {
        const response = await fetch(`${getAPIBaseUrl()}/oxview/structures/${id}`, {
            headers: getAuthHeader(),
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error("Failed to fetch structure details");
        }
        return await response.json();
    } catch (error) {
        console.error(`getRemoteStructureDetails error for id ${id}:`, error);
        return null;
    }
}

async function createRemoteStructure(structureName: string): Promise<OxViewStructure | null> {
    if (!isLoggedIn()) return null;

    try {
        const response = await fetch(`${getAPIBaseUrl()}/oxview/structures`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
            },
            body: JSON.stringify({ structureName }),
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error("Failed to create structure");
        }
        return await response.json();
    } catch (error) {
        console.error("createRemoteStructure error:", error);
        return null;
    }
}

async function deleteRemoteStructure(id: string): Promise<boolean> {
    if (!isLoggedIn()) return false;

    try {
        const response = await fetch(`${getAPIBaseUrl()}/oxview/structures/${id}`, {
            method: "DELETE",
            headers: getAuthHeader(),
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error("Failed to delete structure");
        }
        return true;
    } catch (error) {
        console.error(`deleteRemoteStructure error for id ${id}:`, error);
        return false;
    }
}

async function addRemoteCommit(id: string, commit: any, branchName: string, parentCommitId: string | null) {
    if (!isLoggedIn()) return null;

    try {
        const response = await fetch(`${getAPIBaseUrl()}/oxview/structures/${id}/commits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
            },
            body: JSON.stringify({ commit, branchName, parentCommitId }),
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error("Failed to add commit");
        }
        return await response.json();
    } catch (error) {
        console.error(`addRemoteCommit error for id ${id}:`, error);
        return null;
    }
}

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

(window as any).getAuthHeader = getAuthHeader;
(window as any).getRemoteStructurse = getRemoteStructures;
(window as any).getRemoteStructureDetails = getRemoteStructureDetails;
(window as any).createRemoteStructure = createRemoteStructure;
(window as any).deleteRemoteStructure = deleteRemoteStructure;
(window as any).addRemoteCommit = addRemoteCommit;
(window as any).arrayBufferToBase64 = arrayBufferToBase64;
