/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />
// Fetch remote projects and their metadata
async function fetchRemoteProjects() {
    try {
        // Check if user is logged in
        if (!window.isLoggedIn || !window.isLoggedIn()) {
            return [];
        }
        // Show loading indicator
        const notify = window.Metro?.notify;
        if (notify) {
            notify.create("Fetching remote projects...", null, {
                cls: "info",
                keepOpen: true,
                element: '#library-notification'
            });
        }
        // Get remote projects
        const remoteProjects = await window.getRemoteStructures();
        // Hide loading indicator
        if (notify) {
            const notificationElements = document.querySelectorAll('#library-notification .notify');
            notificationElements.forEach(el => el.remove());
        }
        return remoteProjects || [];
    }
    catch (error) {
        console.error("Error fetching remote projects:", error);
        const notify = window.Metro?.notify;
        if (notify) {
            notify.create("Failed to fetch remote projects", null, {
                cls: "alert",
                keepOpen: false
            });
            // Hide loading indicator
            const notificationElements = document.querySelectorAll('#library-notification .notify');
            notificationElements.forEach(el => el.remove());
        }
        return [];
    }
}
// Add function to determine sync status
async function getProjectSyncStatus(localProject) {
    try {
        // Public clone detection (has publicSourceId but not a standard sync)
        if (localProject.publicSourceId && (!localProject.isSynced || !localProject.syncedProjectId)) {
            try {
                const remotePublicCommits = await window.getPublicProjectCommits(localProject.publicSourceId);
                const remoteCount = remotePublicCommits ? remotePublicCommits.length : 0;
                const localCount = localProject.commits ? localProject.commits.length : 0;
                if (!remotePublicCommits) {
                    return { status: 'public-out-of-sync', direction: 'pull', localCommitCount: localCount, remoteCommitCount: 0 };
                }
                // Determine if any remote commit IDs are missing locally
                const localIds = new Set(localProject.commits.map((c) => c.commitId));
                const missing = remotePublicCommits.some((rc) => !localIds.has(rc.id));
                if (missing) {
                    return {
                        status: 'public-out-of-sync',
                        direction: 'pull',
                        localCommitCount: localCount,
                        remoteCommitCount: remoteCount
                    };
                }
                return {
                    status: 'public-synced',
                    localCommitCount: localCount,
                    remoteCommitCount: remoteCount
                };
            }
            catch (e) {
                console.warn('Public sync status check failed', e);
                return {
                    status: 'public-out-of-sync',
                    direction: 'pull',
                    localCommitCount: localProject.commits ? localProject.commits.length : 0,
                    remoteCommitCount: 0
                };
            }
        }
        // If project is not marked as synced (and not public clone), it's local only
        if (!localProject.isSynced || !localProject.syncedProjectId) {
            return {
                status: 'local',
                localCommitCount: localProject.commits ? localProject.commits.length : 0
            };
        }
        // Get remote project commits
        const remoteCommits = await window.getProjectCommits(localProject.syncedProjectId);
        // If we couldn't get remote commits, assume out of sync
        if (!remoteCommits) {
            return {
                status: 'out-of-sync',
                direction: 'pull',
                localCommitCount: localProject.commits ? localProject.commits.length : 0,
                remoteCommitCount: 0
            };
        }
        const localCommitCount = localProject.commits ? localProject.commits.length : 0;
        const remoteCommitCount = remoteCommits.length;
        // If commit counts match, assume synced
        if (localCommitCount === remoteCommitCount) {
            return {
                status: 'synced',
                localCommitCount: localCommitCount,
                remoteCommitCount: remoteCommitCount
            };
        }
        // If local has more commits, need to push
        if (localCommitCount > remoteCommitCount) {
            return {
                status: 'out-of-sync',
                direction: 'push',
                localCommitCount: localCommitCount,
                remoteCommitCount: remoteCommitCount
            };
        }
        // If remote has more commits, need to pull
        return {
            status: 'out-of-sync',
            direction: 'pull',
            localCommitCount: localCommitCount,
            remoteCommitCount: remoteCommitCount
        };
    }
    catch (error) {
        console.error("Error determining project sync status:", error);
        // Default to local status if there's an error
        return {
            status: 'local',
            localCommitCount: localProject.commits ? localProject.commits.length : 0
        };
    }
}
// Add conflict resolution dialog/modal
function showConflictResolutionDialog(project, localState, remoteState) {
    const content = `
    <div>
      <h4>Sync Conflict Detected</h4>
      <p>The project "${project.structureName}" has divergent changes between local and remote states.</p>
      <div style="display: flex; justify-content: space-around; margin: 20px 0;">
        <div>
          <h5>Local State</h5>
          <p>Commits: ${localState.localCommitCount || 0}</p>
          <p>Last edited: ${new Date(project.date).toLocaleDateString()}</p>
        </div>
        <div>
          <h5>Remote State</h5>
          <p>Commits: ${remoteState.remoteCommitCount || 0}</p>
          <p>Last synced: ${localState.lastSyncTime ? new Date(localState.lastSyncTime).toLocaleDateString() : 'Never'}</p>
        </div>
      </div>
      <p>Please choose how to resolve this conflict:</p>
    </div>
  `;
    window.Metro.dialog.create({
        title: "Resolve Sync Conflict",
        content: content,
        actions: [
            {
                caption: "Keep Local Version",
                cls: "js-dialog-close primary",
                onclick: () => {
                    // Push local changes to remote (overwrite remote)
                    syncProjectToCloud(project.id, project.structureName);
                }
            },
            {
                caption: "Use Remote Version",
                cls: "js-dialog-close warning",
                onclick: () => {
                    // Pull remote changes (overwrite local)
                    pullRemoteProject(project.id, project.syncedProjectId);
                }
            },
            {
                caption: "Cancel",
                cls: "js-dialog-close"
            }
        ]
    });
}
// Function to pull remote project and overwrite local
async function pullRemoteProject(projectIdOrRemote, remoteProjectId) {
    try {
        // Support two call styles:
        // 1) pullRemoteProject(projectId: string, remoteProjectId: string)
        // 2) pullRemoteProject(remoteProjectObject, remoteProjectId)  -- used by remote project card
        let remoteId = remoteProjectId;
        let remoteObj = undefined;
        let localId = undefined;
        if (typeof projectIdOrRemote === 'object' && projectIdOrRemote !== null) {
            // Called with remote project object as first arg
            remoteObj = projectIdOrRemote;
            remoteId = remoteObj.id;
            localId = remoteId;
        }
        else {
            // Called with local project id first
            localId = projectIdOrRemote;
        }
        if (!remoteId) {
            console.warn('pullRemoteProject: missing remote project id');
            alert('No remote project id provided');
            return;
        }
        // Get remote project commits
        const remoteCommits = await window.getProjectCommits(remoteId);
        if (!remoteCommits || remoteCommits.length === 0) {
            alert("No commits found in remote project");
            return;
        }
        // Download commit data for each commit and transform to local format
        const localCommits = [];
        for (const commit of remoteCommits) {
            // Get commit data
            const commitData = await window.readCommitData(remoteId, commit.id);
            if (!commitData) {
                alert(`Failed to download commit ${commit.commitName}`);
                return;
            }
            // Add to local commits array with proper field mapping
            localCommits.push({
                commitId: commit.id,
                commitName: commit.commitName,
                data: commitData,
                parent: commit.parentCommitId || null,
            });
        }
        // If no local project exists, create one using the remote project's id
        const localProject = await window.DexieDB.structureData.get(localId);
        if (!localProject) {
            const newProject = {
                id: remoteId,
                commits: localCommits,
                structureName: (remoteObj && (remoteObj.projectName || remoteObj.name)) || 'Remote Project',
                date: Date.now(),
                branches: { main: localCommits.map((c) => c.commitId) },
                isSynced: true,
                syncedProjectId: remoteId,
                isRemote: true,
            };
            await window.DexieDB.structureData.put(newProject);
            alert("Remote project pulled successfully!");
            refreshLibraryCards();
            return;
        }
        // Otherwise update existing local project with remote commits and mark as synced
        await window.DexieDB.structureData.update(localId, {
            commits: localCommits,
            date: Date.now(),
            isSynced: true,
            syncedProjectId: remoteId,
        });
        alert("Remote project pulled successfully!");
        refreshLibraryCards();
    }
    catch (error) {
        console.error("Error pulling remote project:", error);
        alert("Failed to pull remote project");
    }
}
// Async function that simulates fetching the data.
async function fetchLibraryData() {
    const allStructures = await window.DexieDB.structureData.toArray();
    return allStructures.map((i) => {
        const latestCommit = i.commits[i.commits.length - 1]; // Updated to use 'commits'
        return {
            name: i.structureName,
            date: i.date,
            id: i.id,
            latestCommitId: latestCommit ? latestCommit.commitId : null,
        };
    });
}
function createCard(item) {
    const cell = document.createElement("div");
    cell.className = "cell-4";
    const link = document.createElement("a");
    if (item.latestCommitId) {
        link.href = `/?structureId=${item.id}&commit=${item.latestCommitId}&load=true`;
    }
    link.style.textDecoration = "none";
    link.style.color = "inherit";
    const card = document.createElement("div");
    card.className = "card m-2";
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header";
    cardHeader.textContent = item.name;
    card.appendChild(cardHeader);
    const cardContent = document.createElement("div");
    cardContent.className = "card-content p-2";
    cardContent.textContent = `Last edited: ${new Date(item.date).toLocaleDateString()}`;
    card.appendChild(cardContent);
    const cardFooter = document.createElement("div");
    cardFooter.className = "card-footer";
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "button alert small";
    deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        deleteStructure(item.id);
    });
    cardFooter.appendChild(deleteBtn);
    const historyBtn = document.createElement("button");
    historyBtn.textContent = "View History";
    historyBtn.className = "button secondary small";
    historyBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        view.openCommitHistoryModal(item.id);
    });
    cardFooter.appendChild(historyBtn);
    // Remove deprecated share button
    // const shareBtn = document.createElement("button");
    // shareBtn.textContent = "Generate Link";
    // shareBtn.className = "button primary";
    // shareBtn.addEventListener("click", (event) => {
    //   event.preventDefault();
    //   event.stopPropagation();
    //   openBranchSelectionModal(item.id);
    // });
    // cardFooter.appendChild(shareBtn);
    card.appendChild(cardFooter);
    link.appendChild(card);
    cell.appendChild(link);
    return cell;
}
function deleteStructure(id) {
    window.Metro.dialog.create({
        title: "Delete Structure",
        content: `<div>Are you sure you want to delete this structure? This action cannot be undone.</div>`,
        actions: [
            {
                caption: "Yes",
                cls: "js-dialog-close alert",
                onclick: () => {
                    // Delete the structure with the provided id.
                    window.DexieDB.structureData
                        .delete(id)
                        .then(() => {
                        console.log(`Structure with id ${id} deleted successfully.`);
                        // Refresh the library cards to remove stale data
                        refreshLibraryCards();
                    })
                        .catch((error) => {
                        console.error(`Failed to delete structure with id ${id}:`, error);
                    });
                },
            },
            {
                caption: "No",
                cls: "js-dialog-close",
            },
        ],
    });
}
async function initLibrary() {
    const container = document.getElementById("library-container");
    if (!container)
        return;
    // Clear container
    container.innerHTML = "";
    // Add notification container
    const notificationContainer = document.createElement("div");
    notificationContainer.id = "library-notification";
    container.appendChild(notificationContainer);
    // Tier 1: Local Projects. These shouldn't just be local projects but also should have everything that is not shared. It should have a pretty little annotation that says "Local" "Synced" "Out of sync". The "out of sync" should also have an arrow to indicate whether you need to push or pull. If the remote state is and local state are divergent(lets say some third machine changed the remote state), the user HAS to choose to overwrite either the local state, or the remote state.
    await renderLocalProjectsSection(container);
    // Tier 2: Combined Shared Section (if logged in)
    if (isLoggedIn()) {
        await renderSharedSection(container);
    }
}
// Helper function to render pagination controls
function renderPaginationControls(container, currentPage, totalPages, onPageChange) {
    container.innerHTML = "";
    if (totalPages <= 1)
        return;
    const paginationDiv = document.createElement("div");
    paginationDiv.className = "pagination";
    paginationDiv.style.cssText = "display: flex; gap: 10px; justify-content: center; align-items: center;";
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Previous";
    prevBtn.className = "button";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => onPageChange(currentPage - 1));
    paginationDiv.appendChild(prevBtn);
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.textContent = i.toString();
        pageBtn.className = currentPage === i ? "button primary" : "button";
        pageBtn.addEventListener("click", () => onPageChange(i));
        paginationDiv.appendChild(pageBtn);
    }
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.className = "button";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => onPageChange(currentPage + 1));
    paginationDiv.appendChild(nextBtn);
    container.appendChild(paginationDiv);
}
// NEW: Render local projects section with pagination
async function renderLocalProjectsSection(container) {
    const section = document.createElement("div");
    section.className = "row local-projects-section";
    section.innerHTML = '<h3 class="cell-12">Projects</h3>';
    // Add pull notification container
    const pullNotificationContainer = document.createElement("div");
    pullNotificationContainer.id = "pull-notification";
    section.appendChild(pullNotificationContainer);
    const localProjects = await window.DexieDB.structureData.toArray();
    // Get remote projects if user is logged in
    let remoteProjects = [];
    if (window.isLoggedIn && window.isLoggedIn()) {
        remoteProjects = await fetchRemoteProjects();
    }
    // Create a map of local projects by syncedProjectId for quick lookup
    const localProjectMap = new Map();
    localProjects.forEach((project) => {
        if (project.syncedProjectId) {
            localProjectMap.set(project.syncedProjectId, project);
        }
    });
    // Filter remote projects to only show those not already local
    const remoteOnlyProjects = remoteProjects.filter((remoteProject) => {
        return !localProjectMap.has(remoteProject.id);
    });
    // Combine all projects into a single list for pagination
    const allProjects = [...localProjects, ...remoteOnlyProjects];
    // Pagination state
    const projectsPerPage = 6; // 2 rows × 3 cards
    let currentPage = 1;
    const totalPages = Math.max(1, Math.ceil(allProjects.length / projectsPerPage));
    const projectsRow = document.createElement("div");
    projectsRow.className = "row cell-12";
    projectsRow.id = "projects-container";
    const paginationContainer = document.createElement("div");
    paginationContainer.className = "cell-12 text-center mt-4";
    paginationContainer.id = "projects-pagination";
    async function renderProjectsPage(page) {
        projectsRow.innerHTML = "";
        const startIdx = (page - 1) * projectsPerPage;
        const endIdx = startIdx + projectsPerPage;
        const pageProjects = allProjects.slice(startIdx, endIdx);
        if (pageProjects.length === 0 && page === 1) {
            const noProjectsMessage = document.createElement("div");
            noProjectsMessage.className = "cell-12 text-center";
            noProjectsMessage.innerHTML = '<p class="text-muted">No projects found. Create a new project or log in to see your synced projects.</p>';
            projectsRow.appendChild(noProjectsMessage);
        }
        else {
            for (const project of pageProjects) {
                let card;
                if (localProjects.includes(project)) {
                    card = await createProjectCard(project);
                }
                else {
                    card = await createRemoteProjectCard(project);
                }
                projectsRow.appendChild(card);
            }
        }
        renderPaginationControls(paginationContainer, page, totalPages, (newPage) => {
            currentPage = newPage;
            renderProjectsPage(newPage);
        });
    }
    section.appendChild(projectsRow);
    section.appendChild(paginationContainer);
    container.appendChild(section);
    await renderProjectsPage(currentPage);
}
// (NOTE) Duplicate code removed. `renderLocalProjectsSection` handles adding projects to the section.
// NEW: Render combined shared section (commits and projects) with pagination
async function renderSharedSection(container) {
    const section = document.createElement("div");
    section.className = "row shared-section mt-4";
    section.innerHTML = '<h3 class="cell-12">Shared by Me</h3>';
    const sharedRow = document.createElement("div");
    sharedRow.className = "row cell-12";
    sharedRow.id = "shared-container";
    // Get shared commits
    const sharedCommits = await getMySharedCommits();
    const commitsPerPage = 6; // 2 rows × 3 cards
    let currentPage = 1;
    const totalPages = Math.max(1, Math.ceil(sharedCommits.length / commitsPerPage));
    const paginationContainer = document.createElement("div");
    paginationContainer.className = "cell-12 text-center mt-4";
    paginationContainer.id = "shared-pagination";
    function renderSharedPage(page) {
        sharedRow.innerHTML = "";
        const startIdx = (page - 1) * commitsPerPage;
        const endIdx = startIdx + commitsPerPage;
        const pageCommits = sharedCommits.slice(startIdx, endIdx);
        if (pageCommits.length === 0 && page === 1) {
            const placeholder = document.createElement("div");
            placeholder.className = "cell-12";
            placeholder.innerHTML = '<p class="text-muted">No shared items found</p>';
            sharedRow.appendChild(placeholder);
        }
        else {
            for (const commit of pageCommits) {
                const card = createSharedCommitCard(commit);
                sharedRow.appendChild(card);
            }
        }
        renderPaginationControls(paginationContainer, page, totalPages, (newPage) => {
            currentPage = newPage;
            renderSharedPage(newPage);
        });
    }
    section.appendChild(sharedRow);
    section.appendChild(paginationContainer);
    container.appendChild(section);
    renderSharedPage(currentPage);
}
// NEW: Create project card with sync status
async function createProjectCard(project) {
    const cell = document.createElement("div");
    cell.className = "cell-4";
    const link = document.createElement("a");
    // Determine the chronologically latest commit (prefer createdAt if available)
    let latestCommit = null;
    if (project.commits && project.commits.length > 0) {
        latestCommit = project.commits.reduce((prev, cur) => {
            const prevTs = prev && prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
            const curTs = cur && cur.createdAt ? new Date(cur.createdAt).getTime() : 0;
            // If neither have createdAt, fallback to array order by returning cur (which is likely appended)
            if (!prev.createdAt && !cur.createdAt)
                return cur;
            return curTs >= prevTs ? cur : prev;
        });
    }
    if (latestCommit) {
        link.href = `/?structureId=${project.id}&commit=${latestCommit.commitId}&load=true`;
    }
    link.style.textDecoration = "none";
    link.style.color = "inherit";
    const card = document.createElement("div");
    card.className = "card m-2";
    // Get sync status
    const syncState = await getProjectSyncStatus(project);
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header";
    // Create sync status badge
    let syncBadge = '';
    switch (syncState.status) {
        case 'local':
            syncBadge = '<span class="badge bg-secondary">Local</span>';
            break;
        case 'synced':
            syncBadge = '<span class="badge bg-success">Synced</span>';
            break;
        case 'out-of-sync':
            syncBadge = '<span class="badge bg-warning">Out of sync</span>';
            break;
        case 'conflict':
            syncBadge = '<span class="badge bg-danger">Conflict</span>';
            break;
        case 'public-synced':
            syncBadge = '<span class="badge bg-info">Public Clone</span>';
            break;
        case 'public-out-of-sync':
            syncBadge = '<span class="badge bg-warning">Public Updates</span>';
            break;
    }
    // Add directional arrows for out-of-sync status
    let directionIndicator = '';
    const isStandardOutOfSync = syncState.status === 'out-of-sync';
    const isPublicOutOfSync = syncState.status === 'public-out-of-sync';
    if ((isStandardOutOfSync || isPublicOutOfSync) && syncState.direction) {
        if (syncState.direction === 'push') {
            directionIndicator = ' <span class="mx-1">↑</span>'; // Up arrow for push
        }
        else if (syncState.direction === 'pull') {
            directionIndicator = ' <span class="mx-1">↓</span>'; // Down arrow for pull
        }
        else if (syncState.direction === 'both') {
            directionIndicator = ' <span class="mx-1">↕</span>'; // Both arrows for conflict
        }
    }
    cardHeader.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span>${project.structureName}</span>
      <div>
        ${syncBadge}${directionIndicator}
      </div>
    </div>
  `;
    card.appendChild(cardHeader);
    const cardContent = document.createElement("div");
    cardContent.className = "card-content p-2";
    cardContent.innerHTML = `
    <div>Last edited: ${new Date(project.date).toLocaleDateString()}</div>
    <div>Commits: ${syncState.localCommitCount || 0}${syncState.remoteCommitCount !== undefined ? ` (Remote: ${syncState.remoteCommitCount})` : ''}</div>
  `;
    card.appendChild(cardContent);
    const cardFooter = document.createElement("div");
    cardFooter.className = "card-footer";
    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "button alert small";
    deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        deleteStructure(project.id);
    });
    cardFooter.appendChild(deleteBtn);
    // History button
    const historyBtn = document.createElement("button");
    historyBtn.textContent = "View History";
    historyBtn.className = "button secondary small";
    historyBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        view.openCommitHistoryModal(project.id);
    });
    cardFooter.appendChild(historyBtn);
    // Sync actions based on status
    if (syncState.status === 'local') {
        const syncBtn = document.createElement("button");
        syncBtn.textContent = "Sync to Cloud";
        syncBtn.className = "button primary small";
        syncBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            syncProjectToCloud(project.id, project.structureName);
        });
        cardFooter.appendChild(syncBtn);
    }
    else if (syncState.status === 'out-of-sync') {
        const syncBtn = document.createElement("button");
        syncBtn.textContent = syncState.direction === 'push' ? "Push Changes" : "Pull Changes";
        syncBtn.className = "button primary small";
        syncBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (syncState.direction === 'push') {
                syncProjectToCloud(project.id, project.structureName);
            }
            else {
                pullRemoteProject(project.id, project.syncedProjectId);
            }
        });
        cardFooter.appendChild(syncBtn);
    }
    else if (syncState.status === 'public-out-of-sync') {
        const refreshPublicBtn = document.createElement("button");
        refreshPublicBtn.textContent = "Pull Public Updates";
        refreshPublicBtn.className = "button primary small";
        refreshPublicBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await refreshPublicClonedProject(project);
        });
        cardFooter.appendChild(refreshPublicBtn);
    }
    else if (syncState.status === 'conflict') {
        const resolveBtn = document.createElement("button");
        resolveBtn.textContent = "Resolve Conflict";
        resolveBtn.className = "button danger small";
        resolveBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            // Show conflict resolution dialog
            showConflictResolutionDialog(project, syncState, syncState);
        });
        cardFooter.appendChild(resolveBtn);
    }
    // Delete remote project button for synced projects
    if (project.isSynced && project.syncedProjectId) {
        const deleteRemoteBtn = document.createElement("button");
        deleteRemoteBtn.textContent = "Delete Remote";
        deleteRemoteBtn.className = "button alert small";
        deleteRemoteBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (confirm(`Are you sure you want to delete the remote copy of "${project.structureName}"? This will delete it from the cloud but keep your local copy.`)) {
                const success = await window.deleteSyncedProject(project.syncedProjectId);
                if (success) {
                    // Update local project to mark as unsynced
                    await window.DexieDB.structureData.update(project.id, {
                        isSynced: false,
                        syncedProjectId: null,
                        isRemote: false
                    });
                    alert("Remote project deleted successfully! Your local copy is now unsynced.");
                    refreshLibraryCards();
                }
                else {
                    alert("Failed to delete remote project. It may have already been deleted.");
                }
            }
        });
        cardFooter.appendChild(deleteRemoteBtn);
        // Toggle public button for synced projects
        const togglePublicBtn = document.createElement("button");
        // Show the current visibility state (Public/Private) rather than the action text.
        togglePublicBtn.textContent = project.isPublic ? "Public" : "Private";
        // Use distinct styling so user can easily see current state.
        togglePublicBtn.className = project.isPublic ? "button success small" : "button secondary small";
        togglePublicBtn.title = project.isPublic ? "Click to make private" : "Click to make public";
        togglePublicBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const result = await window.toggleProjectPublic(project.syncedProjectId);
            if (result.success) {
                // Update local project record
                await window.DexieDB.structureData.update(project.id, {
                    isPublic: result.isPublic
                });
                const notify = window.Metro?.notify;
                if (notify) {
                    notify.create(result.isPublic ? "Project is now public" : "Project is now private", null, { cls: "success", keepOpen: false });
                }
                else {
                    alert(result.isPublic ? "Project is now public" : "Project is now private");
                }
                refreshLibraryCards();
            }
            else {
                alert("Failed to toggle project visibility");
            }
        });
        cardFooter.appendChild(togglePublicBtn);
        // Copy Public Link button (visible only when project is public)
        if (project.isPublic) {
            const copyLinkBtn = document.createElement("button");
            copyLinkBtn.textContent = "Copy Link";
            copyLinkBtn.className = "button primary small";
            copyLinkBtn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                // Determine latest commit if available
                const latestCommit = project.commits && project.commits.length > 0 ? project.commits[project.commits.length - 1] : null;
                const commitPart = latestCommit ? `&commit=${latestCommit.commitId}` : '';
                const publicUrl = `${window.location.origin}/?publicProject=${project.syncedProjectId}${commitPart}&load=true`;
                navigator.clipboard.writeText(publicUrl).then(() => {
                    const notify = window.Metro?.notify;
                    if (notify) {
                        notify.create("Public link copied", null, { cls: "success", keepOpen: false });
                    }
                    else {
                        alert("Public link copied to clipboard");
                    }
                }).catch(err => {
                    console.error('Failed to copy public link', err);
                    alert('Failed to copy link');
                });
            });
            cardFooter.appendChild(copyLinkBtn);
        }
        // Refresh from public source (one-way pull) if cloned from a public project
        if (project.publicSourceId) {
            const refreshBtn = document.createElement("button");
            refreshBtn.textContent = "Refresh";
            refreshBtn.className = "button secondary small";
            refreshBtn.addEventListener("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await refreshPublicClonedProject(project);
            });
            cardFooter.appendChild(refreshBtn);
        }
    }
    card.appendChild(cardFooter);
    link.appendChild(card);
    cell.appendChild(link);
    return cell;
}
// NEW: Create remote project card
async function createRemoteProjectCard(project) {
    const cell = document.createElement("div");
    cell.className = "cell-4";
    const card = document.createElement("div");
    card.className = "card m-2";
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header";
    // Create sync status badge for remote projects
    const syncBadge = '<span class="badge bg-info">Remote</span>';
    cardHeader.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span>${project.projectName}</span>
      <div>
        ${syncBadge}
      </div>
    </div>
  `;
    card.appendChild(cardHeader);
    const cardContent = document.createElement("div");
    cardContent.className = "card-content p-2";
    cardContent.innerHTML = `
    <div>Created: ${new Date(project.createdAt).toLocaleDateString()}</div>
    <div>Commits: ${project.commitCount || 0}</div>
    ${project.latestCommit ? `<div>Last commit: ${new Date(project.latestCommit.createdAt).toLocaleDateString()}</div>` : ''}
  `;
    card.appendChild(cardContent);
    const cardFooter = document.createElement("div");
    cardFooter.className = "card-footer";
    // Pull button for remote projects
    const pullBtn = document.createElement("button");
    pullBtn.textContent = "Pull Project";
    pullBtn.className = "button primary small";
    pullBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Show loading indicator
        pullBtn.disabled = true;
        pullBtn.textContent = "Pulling...";
        try {
            await pullRemoteProject(project, project.id);
        }
        finally {
            pullBtn.disabled = false;
            pullBtn.textContent = "Pull Project";
        }
    });
    cardFooter.appendChild(pullBtn);
    card.appendChild(cardFooter);
    cell.appendChild(card);
    return cell;
}
// NEW: Create shared commit card
function createSharedCommitCard(commit) {
    const cell = document.createElement("div");
    cell.className = "cell-md-4";
    const card = document.createElement("div");
    card.className = "card m-2";
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header";
    cardHeader.textContent = commit.commitName || "Shared Commit";
    card.appendChild(cardHeader);
    const cardContent = document.createElement("div");
    cardContent.className = "card-content p-2";
    cardContent.innerHTML = `
    <p>Shared on: ${new Date(commit.createdAt).toLocaleDateString()}</p>
    <p>Share URL: <a href="${commit.shareUrl}" target="_blank">${commit.shareUrl}</a></p>
  `;
    card.appendChild(cardContent);
    const cardFooter = document.createElement("div");
    cardFooter.className = "card-footer";
    // Load button
    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load";
    loadBtn.className = "button primary small";
    loadBtn.addEventListener("click", () => {
        window.location.href = commit.shareUrl;
    });
    cardFooter.appendChild(loadBtn);
    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "button alert small";
    deleteBtn.addEventListener("click", async () => {
        console.log("Attempting to delete shared commit:", commit);
        console.log("Share ID being used:", commit.commitId);
        if (confirm("Are you sure you want to delete this shared commit?")) {
            const success = await deleteSharedCommit(commit.commitId);
            if (success) {
                alert("Shared commit deleted successfully!");
                refreshLibraryCards();
            }
            else {
                alert("Failed to delete shared commit. It may have already been deleted.");
            }
        }
    });
    cardFooter.appendChild(deleteBtn);
    card.appendChild(cardFooter);
    cell.appendChild(card);
    return cell;
}
// Refresh logic for public cloned projects (one-way sync)
async function refreshPublicClonedProject(localProject) {
    try {
        const notify = window.Metro?.notify;
        if (notify) {
            notify.create("Refreshing public project...", null, { cls: "info", keepOpen: false });
        }
        const sourceId = localProject.publicSourceId;
        if (!sourceId)
            return;
        // Fetch remote commit list
        const remoteCommits = await window.getPublicProjectCommits(sourceId);
        if (!remoteCommits || remoteCommits.length === 0) {
            if (notify)
                notify.create("No public commits found", null, { cls: "warning", keepOpen: false });
            return;
        }
        // Determine new commits (by id)
        const existingCommitIds = new Set((localProject.commits || []).map((c) => c.commitId));
        const newRemoteCommits = remoteCommits.filter((rc) => !existingCommitIds.has(rc.id));
        if (newRemoteCommits.length === 0) {
            if (notify)
                notify.create("Already up to date", null, { cls: "success", keepOpen: false });
            return;
        }
        // Fetch data for each new commit and append
        for (const rc of newRemoteCommits) {
            const dataBuf = await window.readPublicCommitData(sourceId, rc.id);
            if (!dataBuf) {
                console.warn(`refreshPublicClonedProject: Failed to read commit data for ${rc.id}`);
                continue;
            }
            localProject.commits.push({
                commitId: rc.id,
                commitName: rc.commitName || 'Commit',
                data: dataBuf,
                parent: rc.parentCommitId || null,
                createdAt: rc.createdAt || Date.now()
            });
            // Update main branch listing
            if (!localProject.branches)
                localProject.branches = { main: [] };
            if (!localProject.branches.main)
                localProject.branches.main = [];
            localProject.branches.main.push(rc.id);
        }
        // Ensure chronological order and reconstruct branches
        if (!localProject.commits)
            localProject.commits = [];
        localProject.commits.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        // reconstruct branches if parent info present
        const hasParentInfoLocal = localProject.commits.length <= 1 || localProject.commits.some((c, i) => i > 0 && c.parent);
        if (hasParentInfoLocal) {
            const childMap = new Map();
            const parentMap = new Map();
            for (const c of localProject.commits) {
                parentMap.set(c.commitId, c.parent || null);
                if (c.parent) {
                    if (!childMap.has(c.parent))
                        childMap.set(c.parent, []);
                    childMap.get(c.parent).push(c.commitId);
                }
            }
            const leaves = localProject.commits.filter((c) => !childMap.has(c.commitId));
            const branches = {};
            leaves.forEach((leaf, idx) => {
                const branchName = idx === 0 ? 'main' : `branch ${idx + 1}`;
                const branchCommits = [];
                let current = leaf.commitId;
                const visited = new Set();
                while (current && !visited.has(current)) {
                    visited.add(current);
                    branchCommits.unshift(current);
                    current = parentMap.get(current) || null;
                }
                branches[branchName] = branchCommits;
            });
            localProject.branches = branches;
        }
        else {
            localProject.branches = { main: localProject.commits.map((c) => c.commitId) };
        }
        // Persist updated project
        await window.DexieDB.structureData.put({
            ...localProject,
            date: Date.now()
        });
        if (notify)
            notify.create("Public project refreshed", null, { cls: "success", keepOpen: false });
        refreshLibraryCards();
    }
    catch (e) {
        console.error("refreshPublicClonedProject error", e);
        const notify = window.Metro?.notify;
        if (notify)
            notify.create("Failed to refresh", null, { cls: "alert", keepOpen: false });
        else
            alert("Failed to refresh public project");
    }
}
// NEW: Sync project to cloud
async function syncProjectToCloud(projectId, projectName) {
    try {
        // Get local project data
        const localProject = await window.DexieDB.structureData.get(projectId);
        if (!localProject) {
            alert("Local project not found");
            return;
        }
        // Prevent attempting to sync a project cloned from a public source directly
        if (localProject.publicSourceId) {
            alert("This project was cloned from a public source and cannot be synced upstream.");
            return;
        }
        // If project already synced, only push new commits
        if (localProject.isSynced && localProject.syncedProjectId) {
            const remoteId = localProject.syncedProjectId;
            // Fetch remote commits to determine which are new
            const remoteCommits = await getProjectCommits(remoteId);
            const remoteCommitIds = new Set(remoteCommits.map((c) => c.id));
            const newCommits = localProject.commits.filter((c) => !remoteCommitIds.has(c.commitId));
            if (newCommits.length === 0) {
                alert("No new commits to push.");
                return;
            }
            for (const commit of newCommits) {
                await addRemoteCommit(remoteId, commit, "main", commit.parent);
            }
            alert(`Pushed ${newCommits.length} new commit(s) to cloud.`);
            refreshLibraryCards();
            return;
        }
        // Otherwise create a new remote project with a fresh backend ID (do NOT force local ID to avoid collisions)
        const remoteProject = await createRemoteStructure(projectName);
        if (!remoteProject) {
            alert("Failed to create remote project");
            return;
        }
        // Sync all existing local commits
        for (const commit of localProject.commits) {
            await addRemoteCommit(remoteProject.id, commit, "main", commit.parent);
        }
        // Mark project as synced locally
        await window.markProjectAsSynced(projectId, remoteProject.id);
        alert("Project initially synced to cloud successfully!");
        refreshLibraryCards();
    }
    catch (error) {
        console.error("Error syncing project to cloud:", error);
        alert("Failed to sync project to cloud");
    }
}
// NEW: Refresh library cards
function refreshLibraryCards() {
    const container = document.getElementById("library-container");
    if (!container)
        return;
    initLibrary(); // Re-initialize the entire library
}
async function createNew() {
    try {
        const nameElement = document.getElementById("create-structure-name");
        if (!nameElement || nameElement.value === "") {
            alert("Please give a name");
        }
        else {
            const newId = window.createId();
            console.log("i got called", newId);
            await window.DexieDB.structureData.add({
                id: newId,
                commits: [],
                structureName: nameElement.value,
                date: Date.now(),
                branches: { main: [] },
                isSynced: false,
                syncedProjectId: null,
            });
            // Redirect to the new structure's page using its ID.
            window.location.href = `/?structureId=${newId}`;
        }
    }
    catch (error) {
        console.error("Error creating a new structure:", error);
    }
}
// Initialize the library once the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initLibrary());
}
else {
    initLibrary();
}
window.createNew = createNew;
window.refreshLibraryCards = refreshLibraryCards;
