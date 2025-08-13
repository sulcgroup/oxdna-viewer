/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import { deflate, inflate } from "https://cdn.skypack.dev/pako";

export function createCompressedOxViewFile(
  space?: string | number,
): Uint8Array {
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
export async function saveStructure(): Promise<void> {
  try {
    const commitNameElement = document.getElementById(
      "commitName",
    ) as HTMLInputElement;

    if (!commitNameElement || commitNameElement.value === "") {
      alert("No commit name given");
      return;
    }
    const compressedData = createCompressedOxViewFile();
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const structureId = urlParams.get("structureId") as string;
    const currentBranchName = urlParams.get("branch") || "main"; // Get current branch from URL
    const loadedCommitId = urlParams.get("commit"); // Get loaded commit ID from URL

    if (!structureId) {
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
      await (window as any).DexieDB.structureData.put(newStructure);
      alert("Structure created and saved to library!");
      // Redirect to new structure page
      window.location.href = `/?structureId=${newStructureId}&branch=main&load=true`;
      return;
    }

    const oldStructure = await (window as any).DexieDB.structureData.get(structureId);
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
      await (window as any).DexieDB.structureData.put(newStructure);
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

      } else { // User chose to override (delete future commits)
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
    } else { // Normal commit (at head of branch or first commit)
      if (!newBranches[currentBranchName]) {
        newBranches[currentBranchName] = [];
      }
      newBranches[currentBranchName].push(newCommitId);
    }

    const newCommit = {
      data: compressedData,
      commitName: commitNameElement.value,
      commitId: newCommitId,
      parent: parentCommitId,
    };

    newStructureArray.push(newCommit);

    await (window as any).DexieDB.structureData.put({
      id: structureId,
      structure: newStructureArray,
      date: Date.now(), // Update date on commit
      structureName: oldStructure.structureName,
      branches: newBranches,
    });

    alert("Structure saved successfully!");

  } catch (error) {
    console.error("Error saving structure:", error);
  }
}


/**
 * Loads a structure from the database.
 * Can load a specific commit, the head of a branch, or the head of the main branch.
 */
export async function loadStructure(): Promise<void> {
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
    const storedData = await (window as any).DexieDB.structureData.get(id);
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
      commitToLoad = storedData.structure.find((c: any) => c.commitId === commitId);
      if (!commitToLoad) {
        console.error(`loadStructure: Commit with ID ${commitId} not found in structure ${id}.`);
        return; // Exit early if specific commit not found
      }
      console.log("loadStructure: Specific commit found.", commitToLoad);
    } else {
      console.log("loadStructure: No specific commitId provided. Determining commit based on branch.");
      if (branchName) {
        console.log(`loadStructure: Branch name provided: ${branchName}.`);
        const branch = storedData.branches[branchName];
        if (branch && branch.length > 0) {
          const headCommitId = branch[branch.length - 1];
          commitToLoad = storedData.structure.find((c: any) => c.commitId === headCommitId);
          console.log(`loadStructure: Head commit of branch ${branchName} is: ${headCommitId}.`);
        } else {
          console.warn(`loadStructure: Branch '${branchName}' not found or empty for structure ${id}.`);
        }
      } else {
        console.log("loadStructure: No branch name provided. Defaulting to 'main' branch.");
        const mainBranch = storedData.branches["main"];
        if (mainBranch && mainBranch.length > 0) {
          const headCommitId = mainBranch[mainBranch.length - 1];
          commitToLoad = storedData.structure.find((c: any) => c.commitId === headCommitId);
          console.log(`loadStructure: Head commit of 'main' branch is: ${headCommitId}.`);
        } else {
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
      handleFiles([file]);
      console.log("loadStructure: handleFiles called. Function complete.");
    } else {
      console.error("loadStructure: No commit found to load.");
    }
  } catch (error) {
    console.error("loadStructure: Error during execution:", error);
  }
}

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

// Only attempt to load a structure if the 'load' parameter is explicitly set to 'true'
// This prevents unintended loading when simply navigating to the root URL.
if (urlParams.get("load") === "true") {
  loadStructure();
  console.log("called thing")
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

  const localStructure = await (window as any).DexieDB.structureData.get(structureId);
  if (!localStructure) {
    console.error(`No local structure found for structureId: ${structureId}`);
    return;
  }

  await (window as any).DexieDB.remoteStructureData.put(localStructure);
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

  const remoteStructure = await (window as any).DexieDB.remoteStructureData.get(structureId);
  if (!remoteStructure) {
    alert("No remote structure found to pull from.");
    return;
  }

  await (window as any).DexieDB.structureData.put(remoteStructure);
  alert("Pulled from remote!");
  window.location.reload();
}

(window as any).saveStructure = saveStructure;
(window as any).loadStructure = loadStructure;
(window as any).pushToRemote = pushToRemote;
(window as any).pullFromRemote = pullFromRemote;
