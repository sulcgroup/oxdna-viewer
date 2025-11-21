/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

/**
 * Sync API functions for OxView Sync & Share functionality
 * Handles communication with backend sync and share endpoints
 */

// Helper function to get API base URL
function getAPIBaseUrl(): string {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
    return "http://localhost:3002/api/v1";
  }
  return "https://api.nanobase.org/api/v1";
}

// Helper function to get auth header
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper function to check if user is logged in
function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}

// Helper function to handle logout on 401
function logout(): void {
  localStorage.removeItem("token");
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Get all synced projects for the authenticated user
 * GET /api/v1/sync/projects
 */
async function getRemoteStructures(): Promise<any[]> {
  if (!isLoggedIn()) {
    console.log("User not logged in, returning empty array");
    return [];
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const response = await fetch(`${API_BASE}/projects`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        const notify = (window as any).Metro?.notify;
        if (notify) {
          notify.create("Session expired. Please login again.", null, {
            cls: "warning",
            keepOpen: false
          });
        } else {
          alert("Session expired. Please login again.");
        }
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.projects || [];
  } catch (error) {
    console.error("getRemoteStructures error:", error);
    const notify = (window as any).Metro?.notify;
    if (notify) {
      notify.create("Failed to fetch remote projects", null, {
        cls: "alert",
        keepOpen: false
      });
    }
    return [];
  }
}

/**
 * Create a new synced project
 * POST /api/v1/sync/project
 */
async function createRemoteStructure(structureName: string, projectId?: string): Promise<any | null> {
  if (!isLoggedIn()) {
    console.log("User not logged in, returning null");
    alert("Please login to create synced projects");
    return null;
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const requestBody: any = { projectName: structureName };
    if (projectId) {
      requestBody.projectId = projectId;
    }

    const response = await fetch(`${API_BASE}/project`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to create synced projects");
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.project || null;
  } catch (error) {
    console.error("createRemoteStructure error:", error);
    return null;
  }
}

/**
 * Add a commit to a synced project
 * POST /api/v1/sync/project/:projectId/commit
 */
async function addRemoteCommit(
  projectId: string,
  commit: any,
  branchName: string,
  parentCommitId: string | null
): Promise<any | null> {
  if (!isLoggedIn()) {
    console.log("User not logged in, returning null");
    alert("Please login to add commits to synced projects");
    return null;
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const requestBody: any = {
      commitName: commit.commitName,
      commitData: arrayBufferToBase64(commit.data),
      parentCommitId: parentCommitId,
    };

    // Pass existing commit ID if available
    if (commit.commitId) {
      requestBody.commitId = commit.commitId;
    }

    const response = await fetch(`${API_BASE}/project/${projectId}/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to add commits to synced projects");
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.commit || null;
  } catch (error) {
    console.error("addRemoteCommit error:", error);
    return null;
  }
}

/**
 * Share individual commit
 * POST /api/v1/share/commit
 */
async function shareCommit(commitData: any): Promise<any | null> {
  if (!isLoggedIn()) {
    alert("Please login to share commits");
    return null;
  }

  try {
    const SHARE_API_BASE = `${getAPIBaseUrl()}/share`;
    const response = await fetch(`${SHARE_API_BASE}/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ structureData: commitData }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to share commits");
        return null;
      }
      throw new Error("Failed to share commit");
    }

    return await response.json();
  } catch (error) {
    console.error("shareCommit error:", error);
    return null;
  }
}

/**
 * Get user's shared commits
 * GET /api/v1/share/my-commits
 */
async function getMySharedCommits(): Promise<any[]> {
  if (!isLoggedIn()) {
    console.log("User not logged in, returning empty array");
    return [];
  }

  try {
    const SHARE_API_BASE = `${getAPIBaseUrl()}/share`;
    const response = await fetch(`${SHARE_API_BASE}/my-commits`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to view your shared commits");
        return [];
      }
      throw new Error("Failed to fetch shared commits");
    }

    const data = await response.json();
    return data.commits || [];
  } catch (error) {
    console.error("getMySharedCommits error:", error);
    return [];
  }
}

/**
 * Toggle project public status
 * PATCH /api/v1/sync/project/:projectId/public
 */
async function toggleProjectPublic(projectId: string): Promise<{ success: boolean; isPublic?: boolean }> {
  if (!isLoggedIn()) {
    alert("Please login to toggle project visibility");
    return { success: false };
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const response = await fetch(`${API_BASE}/project/${projectId}/public`, {
      method: "PATCH",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to toggle project visibility");
        return { success: false };
      }
      throw new Error("Failed to toggle project visibility");
    }

    const data = await response.json();
    return { success: true, isPublic: data.isPublic };
  } catch (error) {
    console.error("toggleProjectPublic error:", error);
    return { success: false };
  }
}

/**
 * Get all commits for a project
 * GET /api/v1/sync/project/:projectId/commits
 */
async function getProjectCommits(projectId: string): Promise<any[]> {
  if (!isLoggedIn()) {
    console.log("User not logged in, returning empty array");
    return [];
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const response = await fetch(`${API_BASE}/project/${projectId}/commits`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        const notify = (window as any).Metro?.notify;
        if (notify) {
          notify.create("Session expired. Please login again.", null, {
            cls: "warning",
            keepOpen: false
          });
        } else {
          alert("Session expired. Please login again.");
        }
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return (data.commits || []).map((c: any) => ({
      id: c.id,
      commitName: c.commitName,
      createdAt: c.createdAt,
      parentCommitId: c.parentCommitId || null
    }));
  } catch (error) {
    console.error("getProjectCommits error:", error);
    const notify = (window as any).Metro?.notify;
    if (notify) {
      notify.create("Failed to fetch project commits", null, {
        cls: "alert",
        keepOpen: false
      });
    }
    return [];
  }
}

/**
 * Delete a synced project
 * DELETE /api/v1/sync/project/:projectId
 */
async function deleteSyncedProject(projectId: string): Promise<boolean> {
  if (!isLoggedIn()) {
    alert("Please login to delete synced projects");
    return false;
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const response = await fetch(`${API_BASE}/project/${projectId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to delete synced projects");
        return false;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("deleteSyncedProject error:", error);
    return false;
  }
}

/**
 * Get a shared commit (public access)
 * GET /api/v1/share/commit/:shareId
 */
async function getSharedCommit(shareId: string): Promise<any | null> {
  try {
    const SHARE_API_BASE = `${getAPIBaseUrl()}/share`;
    const response = await fetch(`${SHARE_API_BASE}/commit/${shareId}`);

    if (!response.ok) {
      if (response.status === 404) {
        alert("Shared commit not found or has expired.");
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.structure || null;
  } catch (error) {
    console.error("getSharedCommit error:", error);
    return null;
  }
}

/**
 * Delete a shared commit
 * DELETE /api/v1/share/commit/:shareId
 */
async function deleteSharedCommit(shareId: string): Promise<boolean> {
  if (!isLoggedIn()) {
    alert("Please login to delete shared commits");
    return false;
  }

  if (!shareId) {
    console.error("deleteSharedCommit: No shareId provided");
    return false;
  }

  try {
    const SHARE_API_BASE = `${getAPIBaseUrl()}/share`;
    const response = await fetch(`${SHARE_API_BASE}/commit/${shareId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        alert("Please login to delete shared commits");
        return false;
      }
      if (response.status === 404) {
        console.warn(`Shared commit ${shareId} not found - may have been already deleted`);
        return false;
      }
      throw new Error("Failed to delete shared commit");
    }

    return true;
  } catch (error) {
    console.error("deleteSharedCommit error:", error);
    return false;
  }
}

/**
 * Read commit data from filesystem
 * GET /api/v1/sync/project/:projectId/commit/:commitId/data
 */
async function readCommitData(projectId: string, commitId: string): Promise<ArrayBuffer | null> {
  if (!isLoggedIn()) {
    console.log("User not logged in, returning null");
    const notify = (window as any).Metro?.notify;
    if (notify) {
      notify.create("Please login to read commit data", null, {
        cls: "warning",
        keepOpen: false
      });
    } else {
      alert("Please login to read commit data");
    }
    return null;
  }

  try {
    const API_BASE = `${getAPIBaseUrl()}/sync`;
    const response = await fetch(`${API_BASE}/project/${projectId}/commit/${commitId}/data`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        const notify = (window as any).Metro?.notify;
        if (notify) {
          notify.create("Session expired. Please login again.", null, {
            cls: "warning",
            keepOpen: false
          });
        } else {
          alert("Session expired. Please login again.");
        }
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Convert base64 to ArrayBuffer
    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("readCommitData error:", error);
    const notify = (window as any).Metro?.notify;
    if (notify) {
      notify.create("Failed to read commit data", null, {
        cls: "alert",
        keepOpen: false
      });
    }
    return null;
  }
}

// Make functions available globally
(window as any).getRemoteStructures = getRemoteStructures;
(window as any).createRemoteStructure = createRemoteStructure;
(window as any).addRemoteCommit = addRemoteCommit;
(window as any).shareCommit = shareCommit;
(window as any).getMySharedCommits = getMySharedCommits;
(window as any).toggleProjectPublic = toggleProjectPublic;
(window as any).getProjectCommits = getProjectCommits;
(window as any).deleteSyncedProject = deleteSyncedProject;
(window as any).getSharedCommit = getSharedCommit;
(window as any).deleteSharedCommit = deleteSharedCommit;
(window as any).readCommitData = readCommitData;

/**
 * Public project API (unauthenticated)
 */
async function getPublicProject(projectId: string): Promise<any | null> {
  try {
    const API_BASE = `${getAPIBaseUrl()}/public`;
    const response = await fetch(`${API_BASE}/project/${projectId}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.project || null;
  } catch (e) {
    console.error('getPublicProject error:', e);
    return null;
  }
}

async function getPublicProjectCommits(projectId: string): Promise<any[]> {
  try {
    const API_BASE = `${getAPIBaseUrl()}/public`;
    const response = await fetch(`${API_BASE}/project/${projectId}/commits`);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return (data.commits || []).map((c: any) => ({
      id: c.id,
      commitName: c.commitName,
      createdAt: c.createdAt,
      parentCommitId: c.parentCommitId || null
    }));
  } catch (e) {
    console.error('getPublicProjectCommits error:', e);
    return [];
  }
}

async function readPublicCommitData(projectId: string, commitId: string): Promise<ArrayBuffer | null> {
  try {
    const API_BASE = `${getAPIBaseUrl()}/public`;
    const response = await fetch(`${API_BASE}/project/${projectId}/commit/${commitId}/data`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error('readPublicCommitData error:', e);
    return null;
  }
}

(window as any).getPublicProject = getPublicProject;
(window as any).getPublicProjectCommits = getPublicProjectCommits;
(window as any).readPublicCommitData = readPublicCommitData;

// Export the getAPIBaseUrl function globally for use in other modules
(window as any).getAPIBaseURL = getAPIBaseUrl;
