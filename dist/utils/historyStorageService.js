/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />
import { deflate, inflate } from "https://cdn.skypack.dev/pako";
export function createCompressedOxViewFile(space) {
    // Prepare your data object
    const data = {
        date: new Date(),
        box: box.toArray(),
        systems,
        forces: forceHandler.forces,
        selections: selectionListHandler.serialize(),
    };
    const jsonString = JSON.stringify(data, null, space);
    return deflate(jsonString, { level: 9 });
}
/**
 * Saves the current structure as a new commit in the specified branch.
 */
export async function saveStructure() {
    try {
        const commitNameElement = document.getElementById("commitName");
        // Note: allow empty/missing commit name input here. If user supplied
        // a name we'll use it; otherwise we'll derive a name later from the
        // previous commit name plus an incrementing numeric suffix.
        const compressedData = createCompressedOxViewFile();
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const structureId = urlParams.get("structureId");
        const currentBranchName = urlParams.get("branch") || "main"; // Get current branch from URL
        const loadedCommitId = urlParams.get("commit"); // Get loaded commit ID from URL
        if (!structureId) {
            // If no project is loaded, delegate to the createNewProject function.
            await createNewProject();
            return;
        }
        const oldStructure = await window.DexieDB.structureData.get(structureId);
        if (!oldStructure) {
            // Prompt user to create a new structure
            const structureName = prompt("No structure found in library. Enter a name for your new structure:");
            if (!structureName) {
                alert("Structure creation cancelled.");
                return;
            }
            // Generate new structureId
            const newStructureId = crypto.randomUUID();
            const newCommitId = crypto.randomUUID();
            const compressedData = createCompressedOxViewFile();
            const commitName = commitNameElement.value || prompt("Name your first commit:");
            if (!commitName) {
                alert("Commit creation cancelled.");
                return;
            }
            const newCommit = {
                data: compressedData,
                commitName: commitName,
                commitId: newCommitId,
                parent: null,
            };
            const newStructure = {
                id: newStructureId,
                structure: [newCommit],
                date: Date.now(),
                structureName: structureName,
                branches: { main: [newCommitId] },
            };
            await window.DexieDB.structureData.put(newStructure);
            alert("Structure created and saved to library!");
            // Redirect to new structure page
            window.location.href = `/?structureId=${newStructureId}&branch=main&load=true`;
            return;
        }
        const currentBranchCommits = oldStructure.branches[currentBranchName];
        const headCommitId = currentBranchCommits ? currentBranchCommits[currentBranchCommits.length - 1] : null;
        let newCommitId = crypto.randomUUID();
        let parentCommitId = headCommitId;
        let newStructureArray = [...oldStructure.structure];
        let newBranches = { ...oldStructure.branches };
        // Scenario: Committing from an older commit (not the head of the current branch)
        if (loadedCommitId && loadedCommitId !== headCommitId) {
            const userChoice = confirm("You are committing from an older version. Do you want to create a new branch? (Cancel to override current branch)");
            if (userChoice) { // User chose to create a new branch
                const newBranchName = prompt("Enter new branch name:");
                if (!newBranchName) {
                    alert("Branch creation cancelled.");
                    return; // Stop the commit process
                }
                if (newBranches[newBranchName]) {
                    alert("Branch name already exists. Please choose a different name.");
                    return; // Stop the commit process
                }
                newBranches[newBranchName] = [loadedCommitId]; // New branch starts from the loaded commit
                parentCommitId = loadedCommitId; // New commit's parent is the loaded commit
                newBranches[newBranchName].push(newCommitId); // Add new commit to the new branch
                // Redirect to the new branch after commit
                window.location.href = `/?structureId=${structureId}&branch=${newBranchName}&load=true`;
            }
            else { // User chose to override (delete future commits)
                if (currentBranchCommits) {
                    const loadedCommitIndex = currentBranchCommits.indexOf(loadedCommitId);
                    if (loadedCommitIndex !== -1) {
                        // Remove future commits from the current branch
                        newBranches[currentBranchName] = currentBranchCommits.slice(0, loadedCommitIndex + 1);
                        // Note: The actual commit objects in `oldStructure.structure` are not deleted here.
                        // They remain in the database but are no longer reachable from this branch.
                        // A full git-like prune would be more involved.
                    }
                }
                parentCommitId = loadedCommitId; // New commit's parent is the loaded commit
                newBranches[currentBranchName].push(newCommitId); // Add new commit to the current branch
            }
        }
        else { // Normal commit (at head of branch or first commit)
            if (!newBranches[currentBranchName]) {
                newBranches[currentBranchName] = [];
            }
            newBranches[currentBranchName].push(newCommitId);
        }
        // Compute commitName: prefer the input value if present, otherwise
        // derive from the previous (head) commit by appending a numeric
        // suffix that starts at 1 and increments ("PrevName 1", "PrevName 2", ...).
        function escapeRegExp(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
        let commitName = null;
        if (commitNameElement && commitNameElement.value && commitNameElement.value.trim() !== "") {
            commitName = commitNameElement.value.trim();
        }
        else {
            // Determine base name from previous commit (head of current branch). If not available,
            // fall back to the most recent commit in the structure. If still not available (shouldn't
            // happen for an existing structure), use a generic base name.
            let baseName = "Commit";
            if (headCommitId) {
                const prev = oldStructure.structure.find((c) => c.commitId === headCommitId);
                if (prev && prev.commitName)
                    baseName = prev.commitName;
            }
            else if (oldStructure.structure && oldStructure.structure.length > 0) {
                const prev = oldStructure.structure[oldStructure.structure.length - 1];
                if (prev && prev.commitName)
                    baseName = prev.commitName;
            }
            // If the previous commit name already ends with a numeric suffix ("Name N"),
            // strip it so we don't produce names like "Name 1 1".
            const trailingNumMatch = baseName.match(/^(.*)\s+(\d+)$/);
            if (trailingNumMatch && trailingNumMatch[1]) {
                baseName = trailingNumMatch[1];
            }
            // Find existing numeric suffixes for this baseName among all commits.
            const re = new RegExp(`^${escapeRegExp(baseName)}\\s+(\\d+)$`);
            const nums = [];
            for (const c of oldStructure.structure) {
                if (!c || !c.commitName)
                    continue;
                const m = c.commitName.match(re);
                if (m && m[1]) {
                    const n = parseInt(m[1], 10);
                    if (!Number.isNaN(n))
                        nums.push(n);
                }
            }
            const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
            commitName = `${baseName} ${next}`;
        }
        const newCommit = {
            data: compressedData,
            commitName: commitName,
            commitId: newCommitId,
            parent: parentCommitId,
        };
        newStructureArray.push(newCommit);
        await window.DexieDB.structureData.put({
            id: structureId,
            structure: newStructureArray,
            date: Date.now(),
            structureName: oldStructure.structureName,
            branches: newBranches,
        });
        alert("Structure saved successfully!");
        // Metro-style notification (if available)
        if (window.notify) {
            try {
                window.notify(`Commit saved with ${commitName}`, 'success');
            }
            catch (e) {
                // noop - don't break save flow if notify fails
            }
        }
    }
    catch (error) {
        console.error("Error saving structure:", error);
    }
}
/**
 * Loads a structure from the database.
 * Can load a specific commit, the head of a branch, or the head of the main branch.
 */
export async function loadStructure() {
    try {
        console.log("loadStructure: Starting function.");
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        console.log("loadStructure: URL Parameters:", Object.fromEntries(urlParams.entries()));
        const id = urlParams.get("structureId");
        if (!id) {
            console.log("loadStructure: structureId parameter not found. Exiting.");
            return;
        }
        console.log(`loadStructure: Attempting to retrieve structure with ID: ${id} from IndexedDB.`);
        const storedData = await window.DexieDB.structureData.get(id);
        if (!storedData) {
            console.error(`loadStructure: No structure found with id ${id}.`);
            return;
        }
        console.log("loadStructure: Structure data retrieved from IndexedDB.", storedData);
        let commitToLoad;
        const commitId = urlParams.get("commit");
        const branchName = urlParams.get("branch");
        if (commitId) {
            console.log(`loadStructure: Specific commitId provided: ${commitId}.`);
            commitToLoad = storedData.structure.find((c) => c.commitId === commitId);
            if (!commitToLoad) {
                console.error(`loadStructure: Commit with ID ${commitId} not found in structure ${id}.`);
                return; // Exit early if specific commit not found
            }
            console.log("loadStructure: Specific commit found.", commitToLoad);
        }
        else {
            console.log("loadStructure: No specific commitId provided. Determining commit based on branch.");
            if (branchName) {
                console.log(`loadStructure: Branch name provided: ${branchName}.`);
                const branch = storedData.branches[branchName];
                if (branch && branch.length > 0) {
                    const headCommitId = branch[branch.length - 1];
                    commitToLoad = storedData.structure.find((c) => c.commitId === headCommitId);
                    console.log(`loadStructure: Head commit of branch ${branchName} is: ${headCommitId}.`);
                }
                else {
                    console.warn(`loadStructure: Branch '${branchName}' not found or empty for structure ${id}.`);
                }
            }
            else {
                console.log("loadStructure: No branch name provided. Defaulting to 'main' branch.");
                const mainBranch = storedData.branches["main"];
                if (mainBranch && mainBranch.length > 0) {
                    const headCommitId = mainBranch[mainBranch.length - 1];
                    commitToLoad = storedData.structure.find((c) => c.commitId === headCommitId);
                    console.log(`loadStructure: Head commit of 'main' branch is: ${headCommitId}.`);
                }
                else {
                    console.warn(`loadStructure: 'main' branch not found or empty for structure ${id}.`);
                }
            }
            if (!commitToLoad && storedData.structure.length > 0) {
                commitToLoad = storedData.structure[storedData.structure.length - 1];
                console.warn(`loadStructure: Falling back to last commit in structure ${id} as no specific commit or branch head could be determined.`);
            }
        }
        if (commitToLoad) {
            console.log("loadStructure: Commit selected for loading.", commitToLoad);
            console.log("loadStructure: Decompressing data...");
            const compData = new Uint8Array(commitToLoad.data);
            const uncompressed = inflate(compData, { to: "string" });
            console.log("loadStructure: Data decompressed. Creating File object...");
            const file = new File([uncompressed], "output.oxview", {
                type: "text/plain",
            });
            console.log("loadStructure: File object created. Calling handleFiles...");
            view.inboxingMode.set("None");
            view.centeringMode.set("None");
            window._isLoadingFromLibrary = true;
            handleFiles([file]);
            console.log("loadStructure: handleFiles called. Function complete.");
        }
        else {
            console.error("loadStructure: No commit found to load.");
        }
    }
    catch (error) {
        console.error("loadStructure: Error during execution:", error);
    }
}
/**
 * Creates a new, empty project in the library.
 */
export async function createNewProject() {
    try {
        // A simple check to see if there's anything on the canvas.
        const isWorkInProgress = systems && systems.length > 0 && systems[0].strands.length > 0;
        if (isWorkInProgress) {
            // Scenario: Something is on the canvas.
            if (confirm("A structure is currently loaded. Do you want to save this as the first version of a new project?")) {
                // User wants to save the current work into a new project.
                const structureName = prompt("Enter a name for your new project:");
                if (!structureName) {
                    alert("Project creation cancelled.");
                    return;
                }
                const commitNameElement = document.getElementById("commitName");
                const commitName = commitNameElement.value.trim() || "Initial commit";
                const newStructureId = crypto.randomUUID();
                const newCommitId = crypto.randomUUID();
                const compressedData = createCompressedOxViewFile();
                const newCommit = {
                    data: compressedData,
                    commitName: commitName,
                    commitId: newCommitId,
                    parent: null,
                };
                const newStructure = {
                    id: newStructureId,
                    structure: [newCommit],
                    date: Date.now(),
                    structureName: structureName,
                    branches: { main: [newCommitId] },
                };
                await window.DexieDB.structureData.put(newStructure);
                alert(`Project "${structureName}" created and initial version saved!`);
                // Redirect to the new project page, loading the saved data.
                window.location.href = `/?structureId=${newStructureId}&branch=main&load=true`;
            }
            else {
                // User does NOT want to save the current work.
                if (confirm("Are you sure? Your current unsaved work will be discarded.")) {
                    // Proceed with creating a blank project.
                    await createBlankProject();
                }
                // If they cancel the second confirmation, do nothing.
            }
        }
        else {
            // Scenario: Canvas is empty. Just create a blank project.
            await createBlankProject();
        }
    }
    catch (error) {
        console.error("Error creating new project:", error);
        alert("Failed to create new project. See console for details.");
    }
}
async function createBlankProject() {
    const structureName = prompt("Enter a name for your new project:");
    if (!structureName || structureName.trim() === "") {
        alert("Project creation cancelled: A name is required.");
        return;
    }
    // Generate new IDs for the structure and the initial commit
    const newStructureId = crypto.randomUUID();
    const newCommitId = crypto.randomUUID();
    // Create a compressed representation of the current (empty) scene
    const compressedData = createCompressedOxViewFile();
    // Use the commit message from the input box if available, otherwise default.
    const commitNameElement = document.getElementById("commitName");
    const commitName = commitNameElement.value.trim() || "Initial commit";
    // Create the initial commit object
    const initialCommit = {
        data: compressedData,
        commitName: commitName,
        commitId: newCommitId,
        parent: null,
    };
    // Create the new structure object, including the initial commit
    const newStructure = {
        id: newStructureId,
        structure: [initialCommit],
        date: Date.now(),
        structureName: structureName,
        branches: { main: [newCommitId] }, // Main branch points to the initial commit
    };
    await window.DexieDB.structureData.put(newStructure);
    alert(`Project "${structureName}" created successfully!`);
    // Redirect to the new project page, and load the initial empty state.
    window.location.href = `/?structureId=${newStructureId}&branch=main&load=true`;
}
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
// Only attempt to load a structure if the 'load' parameter is explicitly set to 'true'
// This prevents unintended loading when simply navigating to the root URL.
if (urlParams.get("load") === "true") {
    loadStructure();
    console.log("called thing");
}
/**
 * Pushes the local structure to the remote repository.
 */
async function pushToRemote() {
    const params = new URLSearchParams(window.location.search);
    const structureId = params.get("structureId");
    if (!structureId) {
        console.error("No structureId query parameter found in the URL.");
        return;
    }
    const localStructure = await window.DexieDB.structureData.get(structureId);
    if (!localStructure) {
        console.error(`No local structure found for structureId: ${structureId}`);
        return;
    }
    await window.DexieDB.remoteStructureData.put(localStructure);
    alert("Pushed to remote!");
}
/**
 * Pulls the remote structure to the local repository.
 */
async function pullFromRemote() {
    const params = new URLSearchParams(window.location.search);
    const structureId = params.get("structureId");
    if (!structureId) {
        console.error("No structureId query parameter found in the URL.");
        return;
    }
    const remoteStructure = await window.DexieDB.remoteStructureData.get(structureId);
    if (!remoteStructure) {
        alert("No remote structure found to pull from.");
        return;
    }
    await window.DexieDB.structureData.put(remoteStructure);
    alert("Pulled from remote!");
    window.location.reload();
}
/**
 * Updates the UI to display the name of the currently loaded project.
 */
async function updateProjectNameDisplay() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const structureId = urlParams.get("structureId");
        const projectNameDisplay = document.getElementById("project-name-display");
        const currentProjectNameSpan = document.getElementById("current-project-name");
        if (!projectNameDisplay || !currentProjectNameSpan)
            return;
        if (structureId) {
            const structure = await window.DexieDB.structureData.get(structureId);
            if (structure && structure.structureName) {
                currentProjectNameSpan.textContent = structure.structureName;
                projectNameDisplay.style.display = "block";
            }
            else {
                // This case handles if the ID is in the URL but not in the DB
                currentProjectNameSpan.textContent = "No Project Loaded";
                projectNameDisplay.style.display = "block";
            }
        }
        else {
            // This is the new part: handles when no project ID is in the URL
            currentProjectNameSpan.textContent = "No Project Loaded";
            projectNameDisplay.style.display = "block";
        }
    }
    catch (error) {
        console.error("Error updating project name display:", error);
        const projectNameDisplay = document.getElementById("project-name-display");
        if (projectNameDisplay) {
            projectNameDisplay.style.display = "none";
        }
    }
}
window.saveStructure = saveStructure;
window.loadStructure = loadStructure;
window.pushToRemote = pushToRemote;
window.pullFromRemote = pullFromRemote;
window.createNewProject = createNewProject;
// Call the function on page load to ensure the project name is displayed if a project is open.
document.addEventListener("DOMContentLoaded", () => {
    updateProjectNameDisplay();
});
