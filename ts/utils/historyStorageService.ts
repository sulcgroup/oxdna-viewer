/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

import { deflate, inflate } from "https://cdn.skypack.dev/pako";

function createCompressedOxViewFile(
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

// Helper: normalize createdAt into numeric timestamp
function commitTimestamp(c: any): number {
  if (!c) return 0;
  if (c.createdAt) return new Date(c.createdAt).getTime();
  if ((c as any).date) return new Date((c as any).date).getTime();
  return 0;
}

// Helper: sort commits ascending by createdAt (oldest -> newest)
function sortCommitsChronologically(commits: any[]) {
  commits.sort((a, b) => commitTimestamp(a) - commitTimestamp(b));
}

// Helper: reconstruct branches from parent links
function reconstructBranchesFromParents(commits: any[]) {
  const branches: Record<string, string[]> = {};
  if (!commits || commits.length === 0) return branches;

  const childMap = new Map<string, string[]>();
  const parentMap = new Map<string, string | null>();
  commits.forEach(c => {
    parentMap.set(c.commitId, c.parent || null);
    if (c.parent) {
      if (!childMap.has(c.parent)) childMap.set(c.parent, []);
      childMap.get(c.parent)!.push(c.commitId);
    }
  });
  // Identify leaves (no children)
  const leaves = commits.filter(c => !childMap.has(c.commitId));
  if (leaves.length === 0) {
    // no branching, put everything in main
    branches['main'] = commits.map(c => c.commitId);
    return branches;
  }
  leaves.forEach((leaf, idx) => {
    const branchName = idx === 0 ? 'main' : `branch ${idx + 1}`;
    const branchCommits: string[] = [];
    let current: string | null = leaf.commitId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      branchCommits.unshift(current);
      current = parentMap.get(current) || null;
    }
    branches[branchName] = branchCommits;
  });
  return branches;
}

/**
 * Saves the current structure as a new commit in the specified branch.
 */
async function saveStructure(): Promise<void> {
  try {
    const commitNameElement = document.getElementById(
      "commitName",
    ) as HTMLInputElement;

    // Note: allow empty/missing commit name input here. If user supplied
    // a name we'll use it; otherwise we'll derive a name later from the
    // previous commit name plus an incrementing numeric suffix.
    const compressedData = createCompressedOxViewFile();
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const structureId = urlParams.get("structureId") as string;
    const currentBranchName = urlParams.get("branch") || "main"; // Get current branch from URL
    const loadedCommitId = urlParams.get("commit"); // Get loaded commit ID from URL

    if (!structureId) {
      // If no project is loaded, delegate to the createNewProject function.
      await createNewProject();
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
      const newStructureId = (window as any).createId();
      const newCommitId = (window as any).createId();
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
        commits: [newCommit], // Renamed from 'structure' to 'commits'
        date: Date.now(),
        structureName: structureName,
        branches: { main: [newCommitId] },
        isSynced: false, // NEW: Default to not synced
        syncedProjectId: null, // NEW: No synced project ID yet
      };
      await (window as any).DexieDB.structureData.put(newStructure);
      alert("Structure created and saved to library!");
      window.location.href = `/?structureId=${newStructureId}&branch=main&load=true`;
      return;
    }

    // (no normalization here)

    const currentBranchCommits = oldStructure.branches[currentBranchName];
    const headCommitId = currentBranchCommits ? currentBranchCommits[currentBranchCommits.length - 1] : null;

    let newCommitId = (window as any).createId();
    let parentCommitId = headCommitId;
    let newStructureArray = [...oldStructure.commits]; // Updated to use 'commits'
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

    // Compute commitName: prefer the input value if present, otherwise
    // derive from the previous (head) commit by appending a numeric
    // suffix that starts at 1 and increments ("PrevName 1", "PrevName 2", ...).
    function escapeRegExp(str: string) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    let commitName: string | null = null;
    if (commitNameElement && commitNameElement.value && commitNameElement.value.trim() !== "") {
      commitName = commitNameElement.value.trim();
    } else {
      // Determine base name from previous commit (head of current branch). If not available,
      // fall back to the most recent commit in the structure. If still not available (shouldn't
      // happen for an existing structure), use a generic base name.
      let baseName = "Commit";
      if (headCommitId) {
        const prev = oldStructure.commits.find((c: any) => c.commitId === headCommitId); // Updated to use 'commits'
        if (prev && prev.commitName) baseName = prev.commitName;
      } else if (oldStructure.commits && oldStructure.commits.length > 0) { // Updated to use 'commits'
        const prev = oldStructure.commits[oldStructure.commits.length - 1]; // Updated to use 'commits'
        if (prev && prev.commitName) baseName = prev.commitName;
      }

      // If the previous commit name already ends with a numeric suffix ("Name N"),
      // strip it so we don't produce names like "Name 1 1".
      const trailingNumMatch = (baseName as string).match(/^(.*)\s+(\d+)$/);
      if (trailingNumMatch && trailingNumMatch[1]) {
        baseName = trailingNumMatch[1];
      }

      // Find existing numeric suffixes for this baseName among all commits.
      const re = new RegExp(`^${escapeRegExp(baseName)}\\s+(\\d+)$`);
      const nums: number[] = [];
      for (const c of oldStructure.commits) { // Updated to use 'commits'
        if (!c || !c.commitName) continue;
        const m = (c.commitName as string).match(re);
        if (m && m[1]) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n)) nums.push(n);
        }
      }
      const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      commitName = `${baseName} ${next}`;
    }

    const newCommit = {
      data: compressedData,
      commitName: commitName!,
      commitId: newCommitId,
      parent: parentCommitId,
      createdAt: Date.now(),
    };

    newStructureArray.push(newCommit);

    // Ensure chronological order and rebuild branches so branch ordering matches timestamps
    sortCommitsChronologically(newStructureArray);
    newBranches = reconstructBranchesFromParents(newStructureArray);

    await (window as any).DexieDB.structureData.put({
      id: structureId,
      commits: newStructureArray, // Updated to use 'commits'
      date: Date.now(), // Update date on commit
      structureName: oldStructure.structureName,
      branches: newBranches,
      isSynced: oldStructure.isSynced || false, // Preserve sync status
      syncedProjectId: oldStructure.syncedProjectId || null, // Preserve synced project ID
    });

    alert("Structure saved successfully!");
    // Metro-style notification (if available)
    if ((window as any).notify) {
      try {
        (window as any).notify(`Commit saved with ${commitName}`, 'success');
      } catch (e) {
        // noop - don't break save flow if notify fails
      }
    }

  } catch (error) {
    console.error("Error saving structure:", error);
  }
}


/**
 * Loads a structure from the database.
 * Can load a specific commit, the head of a branch, or the head of the main branch.
 */
async function loadStructure(): Promise<void> {
  try {
    (window as any).resetScene();
    console.log("loadStructure: Starting function.");
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    console.log("loadStructure: URL Parameters:", Object.fromEntries(urlParams.entries()));

    let id = urlParams.get("structureId");
    const publicProjectId = urlParams.get("publicProject");

    // Support public project loading when structureId is absent but publicProject is provided
    if (!id && publicProjectId) {
      console.log(`loadStructure: No structureId, attempting public project load for id ${publicProjectId}`);
      try {
        const publicProject = await (window as any).getPublicProject(publicProjectId);
        if (!publicProject) {
          console.error(`loadStructure: Public project ${publicProjectId} not found or not public.`);
          return;
        }

        const explicitCommit = urlParams.get("commit");
        const commitToFetchId = explicitCommit || publicProject.latestCommitId;
        if (!commitToFetchId) {
          console.error("loadStructure: No commit available for public project.");
          return;
        }

        const publicCommits = await (window as any).getPublicProjectCommits(publicProjectId);
        const matchedCommitMeta = publicCommits.find((c: any) => c.id === commitToFetchId);
        const commitName = matchedCommitMeta ? matchedCommitMeta.commitName : "Public Commit";

        const commitDataBuffer = await (window as any).readPublicCommitData(publicProjectId, commitToFetchId);
        if (!commitDataBuffer) {
          console.error("loadStructure: Failed to fetch public commit data.");
          return;
        }

        const saveChoice = confirm("This is a public project. Save it to your library? (Cancel to view temporarily)");
        if (!saveChoice) {
          console.log("loadStructure: User opted for temporary view of public project.");
          // Decompress and load directly without persisting
          const compData = new Uint8Array(commitDataBuffer);
          const uncompressed = inflate(compData, { to: "string" });
          const file = new File([uncompressed], "public.oxview", { type: "text/plain" });
          view.inboxingMode.set("None");
          view.centeringMode.set("None");
          (window as any)._isLoadingFromLibrary = true;
          handleFiles([file]);
          return; // Exit early; no storedData path
        }

        // Persist full history clone locally with publicSourceId marker
        // Build full commit objects list (avoid refetch of the already downloaded commit)
        const commitsToStore: any[] = [];
        for (const c of publicCommits) {
          let dataBuf: ArrayBuffer | null = null;
          if (c.id === commitToFetchId) {
            dataBuf = commitDataBuffer; // reuse already downloaded data
          } else {
            dataBuf = await (window as any).readPublicCommitData(publicProjectId, c.id);
            if (!dataBuf) {
              console.warn(`loadStructure: Skipping commit ${c.id} - data fetch failed.`);
              continue;
            }
          }
          commitsToStore.push({
            commitId: c.id,
            commitName: c.commitName || 'Commit',
            data: dataBuf,
            parent: c.parentCommitId || null,
            createdAt: c.createdAt || null
          });
        }

        // Order commits oldest -> newest
        const orderedCommits = commitsToStore.slice();
        sortCommitsChronologically(orderedCommits);

        // Check if we have any parent information (heuristic to detect old/missing data)
        // We expect at least one commit to have a parent if there are > 1 commits and it's a valid tree.
        // If all non-first commits have null parents, we assume data is missing and linearize.
        const hasParentInfo = orderedCommits.length <= 1 || orderedCommits.some((c, i) => i > 0 && c.parent !== null);

        if (!hasParentInfo && orderedCommits.length > 1) {
          console.warn("loadStructure: No parent information found in public project. Falling back to linear history.");
          // Fill missing parents linearly
          for (let i = 0; i < orderedCommits.length; i++) {
            if (!orderedCommits[i].parent) {
              orderedCommits[i].parent = i === 0 ? null : orderedCommits[i - 1].commitId;
            }
          }
        }

        // Reconstruct branches from parent pointers
        // This ensures that if we have a tree structure, we create appropriate branches
        // so the visualizer can display them correctly.
        const branches: Record<string, string[]> = {};

        if (hasParentInfo) {
          const childMap = new Map<string, string[]>();
          const parentMap = new Map<string, string | null>();

          orderedCommits.forEach(c => {
            parentMap.set(c.commitId, c.parent);
            if (c.parent) {
              if (!childMap.has(c.parent)) childMap.set(c.parent, []);
              childMap.get(c.parent)!.push(c.commitId);
            }
          });

          // Identify leaves (commits with no children)
          const leaves = orderedCommits.filter(c => !childMap.has(c.commitId));

          // Create a branch for each leaf
          leaves.forEach((leaf, index) => {
            const branchName = index === 0 ? 'main' : `branch ${index + 1}`;
            const branchCommits: string[] = [];
            let current: string | null = leaf.commitId;
            // Trace back to root
            const visited = new Set<string>();
            while (current && !visited.has(current)) {
              visited.add(current);
              branchCommits.unshift(current);
              current = parentMap.get(current) || null;
            }
            branches[branchName] = branchCommits;
          });
        }

        // Fallback: if no branches created (e.g. linear fallback or empty), put all in main
        if (Object.keys(branches).length === 0) {
          branches['main'] = orderedCommits.map(c => c.commitId);
        }

        const existing = await (window as any).DexieDB.structureData.get(publicProjectId);
        if (!existing) {
          await (window as any).DexieDB.structureData.put({
            id: publicProjectId,
            commits: orderedCommits,
            date: Date.now(),
            structureName: publicProject.projectName,
            branches: branches,
            isSynced: false,
            syncedProjectId: null,
            isPublic: true,
            isRemote: false,
            publicSourceId: publicProjectId
          });
          console.log(`loadStructure: Stored cloned public project with ${orderedCommits.length} commits locally.`);
        } else {
          // Merge: add missing commits
          const existingIds = new Set(existing.commits.map((c: any) => c.commitId));
          let added = 0;
          for (const oc of orderedCommits) {
            if (!existingIds.has(oc.commitId)) {
              existing.commits.push(oc);
              added++;
            }
          }

          // Now sort the combined commits and reconstruct branches based on parent links
          sortCommitsChronologically(existing.commits);
          existing.branches = reconstructBranchesFromParents(existing.commits);

          if (!existing.publicSourceId) existing.publicSourceId = publicProjectId;
          existing.date = Date.now();
          await (window as any).DexieDB.structureData.put(existing);
          console.log(`loadStructure: Merged public project history; added ${added} new commits.`);
        }

        id = publicProjectId;
        console.log(`loadStructure: Public project saved; continuing with id ${id}.`);
      } catch (e) {
        console.error("loadStructure: Error while preparing public project:", e);
        return;
      }
    }

    if (!id) {
      console.log("loadStructure: structureId parameter not found and no publicProject provided. Exiting.");
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
      commitToLoad = storedData.commits.find((c: any) => c.commitId === commitId); // Updated to use 'commits'
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
          commitToLoad = storedData.commits.find((c: any) => c.commitId === headCommitId); // Updated to use 'commits'
          console.log(`loadStructure: Head commit of branch ${branchName} is: ${headCommitId}.`);
        } else {
          console.warn(`loadStructure: Branch '${branchName}' not found or empty for structure ${id}.`);
        }
      } else {
        console.log("loadStructure: No branch name provided. Defaulting to 'main' branch.");
        const mainBranch = storedData.branches["main"];
        if (mainBranch && mainBranch.length > 0) {
          const headCommitId = mainBranch[mainBranch.length - 1];
          commitToLoad = storedData.commits.find((c: any) => c.commitId === headCommitId); // Updated to use 'commits'
          console.log(`loadStructure: Head commit of 'main' branch is: ${headCommitId}.`);
        } else {
          console.warn(`loadStructure: 'main' branch not found or empty for structure ${id}.`);
        }
      }

      if (!commitToLoad && storedData.commits.length > 0) { // Updated to use 'commits'
        commitToLoad = storedData.commits[storedData.commits.length - 1]; // Updated to use 'commits'
        console.warn(`loadStructure: Falling back to last commit in structure ${id} as no specific commit or branch head could be determined.`);
      }
    }

    if (commitToLoad) {
      console.log("loadStructure: Commit selected for loading.", commitToLoad);

      // Handle encrypted commits - decrypt on-the-fly
      let dataToDecompress = commitToLoad.data;

      if (commitToLoad.isEncrypted && commitToLoad.encryptedData && commitToLoad.iv) {
        console.log("loadStructure: Commit is encrypted, decrypting on-the-fly...");

        try {
          // Get token for backend key fetch
          const token = typeof window !== 'undefined' ? (window as any).localStorage.getItem('token') : null;

          if (token) {
            // Fetch the encryption key from backend
            const apiBaseUrl = typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_BASE_URL || 'https://api.nanobase.org/api/v1' : 'https://api.nanobase.org/api/v1';
            
            const keyResponse = await fetch(`${apiBaseUrl}/encryption-key`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (!keyResponse.ok) {
              throw new Error(`Failed to fetch encryption key from backend: ${keyResponse.status}`);
            }

            const keyData = await keyResponse.json();
            if (!keyData || !keyData.key) {
              throw new Error('Invalid encryption key response from backend');
            }

            // Convert base64 key to CryptoKey
            const keyBuffer = Uint8Array.from(atob(keyData.key), c => c.charCodeAt(0));
            const aesKey = await crypto.subtle.importKey(
              'raw',
              keyBuffer,
              { name: 'AES-GCM', length: 256 },
              false,
              ['decrypt']
            );

            // Decrypt the data
            const decryptedData = await crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv: new Uint8Array(commitToLoad.iv)
              },
              aesKey,
              commitToLoad.encryptedData
            );

            // Check if decrypted data is valid
            if (!decryptedData || decryptedData.byteLength === 0) {
              console.error("loadStructure: Decryption resulted in empty data");
              if (typeof (window as any).Metro !== 'undefined') {
                (window as any).Metro.notify({
                  title: 'Decryption Failed',
                  message: 'Failed to decrypt commit data: Decrypted data is empty',
                  type: 'alert',
                });
              }
              return;
            }

            // Use the decrypted data for decompression
            dataToDecompress = decryptedData;
            console.log("loadStructure: Commit decrypted successfully");
          } else {
            console.error("loadStructure: Cannot decrypt commit - no token available");
            // Show error to user
            if (typeof (window as any).Metro !== 'undefined') {
              (window as any).Metro.notify({
                title: 'Decryption Failed',
                message: 'Failed to decrypt commit data. Please ensure you are logged in.',
                type: 'alert',
              });
            }
            return;
          }
        } catch (error) {
          console.error("loadStructure: Failed to decrypt commit:", error);
          // Show error to user
          if (typeof (window as any).Metro !== 'undefined') {
            (window as any).Metro.notify({
              title: 'Decryption Failed',
              message: 'Failed to decrypt commit data. Please try again.',
              type: 'alert',
            });
          }
          return;
        }
      }

      console.log("loadStructure: Decompressing data...");
      const compData = new Uint8Array(dataToDecompress);
      const uncompressed = inflate(compData, { to: "string" });
      console.log("loadStructure: Data decompressed. Creating File object...");

      // Validate the decompressed data before creating file
      if (uncompressed === undefined || uncompressed === null || uncompressed === "") {
        console.error("loadStructure: Decompressed data is invalid (undefined, null, or empty)");
        if (typeof (window as any).Metro !== 'undefined') {
          (window as any).Metro.notify({
            title: 'Data Error',
            message: 'Failed to load structure: Invalid data after decompression',
            type: 'alert',
          });
        }
        return;
      }

      // Additional validation to ensure it's valid JSON
      try {
        JSON.parse(uncompressed);
      } catch (error) {
        console.error("loadStructure: Decompressed data is not valid JSON:", error);
        if (typeof (window as any).Metro !== 'undefined') {
          (window as any).Metro.notify({
            title: 'Data Error',
            message: 'Failed to load structure: Data is not valid JSON format',
            type: 'alert',
          });
        }
        return;
      }

      // Double-check that we have valid string content
      if (typeof uncompressed !== 'string') {
        console.error("loadStructure: Decompressed data is not a string:", typeof uncompressed);
        if (typeof (window as any).Metro !== 'undefined') {
          (window as any).Metro.notify({
            title: 'Data Error',
            message: 'Failed to load structure: Decompressed data is not in expected format',
            type: 'alert',
          });
        }
        return;
      }

      const file = new File([uncompressed], "output.oxview", {
        type: "text/plain",
      });
      console.log("loadStructure: File object created. Calling handleFiles...");
      view.inboxingMode.set("None");
      view.centeringMode.set("None");
      (window as any)._isLoadingFromLibrary = true;

      handleFiles([file]);
      console.log("loadStructure: handleFiles called. Function complete.");

      // Clear sensitive data from memory after loading
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).gc) {
          (window as any).gc();
        }
      }, 100);
    } else {
      console.error("loadStructure: No commit found to load.");
    }
  } catch (error) {
    console.error("loadStructure: Error during execution:", error);
  }
}

/**
 * Creates a new, empty project in the library.
 */
async function createNewProject() {
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

        const commitNameElement = document.getElementById("commitName") as HTMLInputElement;
        const commitName = commitNameElement.value.trim() || "Initial commit";

        const newStructureId = (window as any).createId();
        const newCommitId = (window as any).createId();
        const compressedData = createCompressedOxViewFile();

        const newCommit = {
          data: compressedData,
          commitName: commitName,
          commitId: newCommitId,
          parent: null,
          createdAt: Date.now(),
        };

        const newStructure = {
          id: newStructureId,
          commits: [newCommit], // Renamed from 'structure' to 'commits'
          date: Date.now(),
          structureName: structureName,
          branches: { main: [newCommitId] },
          isSynced: false, // NEW: Default to not synced
          syncedProjectId: null, // NEW: No synced project ID yet
        };

        await (window as any).DexieDB.structureData.put(newStructure);
        alert(`Project "${structureName}" created and initial version saved!`);

        // Redirect to the new project page, loading the saved data.
        window.location.href = `/?structureId=${newStructureId}&branch=main&load=true`;

      } else {
        // User does NOT want to save the current work.
        if (confirm("Are you sure? Your current unsaved work will be discarded.")) {
          // Proceed with creating a blank project.
          await createBlankProject();
        }
        // If they cancel the second confirmation, do nothing.
      }
    } else {
      // Scenario: Canvas is empty. Just create a blank project.
      await createBlankProject();
    }
  } catch (error) {
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
  const newStructureId = (window as any).createId();
  const newCommitId = (window as any).createId();

  // Create a compressed representation of the current (empty) scene
  const compressedData = createCompressedOxViewFile();

  // Use the commit message from the input box if available, otherwise default.
  const commitNameElement = document.getElementById("commitName") as HTMLInputElement;
  const commitName = commitNameElement.value.trim() || "Initial commit";

  // Create the initial commit object
  const initialCommit = {
    data: compressedData,
    commitName: commitName,
    commitId: newCommitId,
    parent: null,
    createdAt: Date.now(),
  };

  // Create the new structure object, including the initial commit
  const newStructure = {
    id: newStructureId,
    commits: [initialCommit], // Renamed from 'structure' to 'commits'
    date: Date.now(),
    structureName: structureName,
    branches: { main: [newCommitId] }, // Main branch points to the initial commit
    isSynced: false, // NEW: Default to not synced
    syncedProjectId: null, // NEW: No synced project ID yet
  };

  await (window as any).DexieDB.structureData.put(newStructure);

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



/**
 * Updates the UI to display the name of the currently loaded project.
 */
async function updateProjectNameDisplay() {
  try {
    const urlParams = new URLSearchParams((window as any).location.search);
    const structureId = urlParams.get("structureId");

    const projectNameDisplay = document.getElementById("project-name-display");
    const currentProjectNameSpan = document.getElementById(
      "current-project-name",
    ) as HTMLSpanElement;

    if (!projectNameDisplay || !currentProjectNameSpan) return;

    if (structureId) {
      const structure = await (window as any).DexieDB.structureData.get(
        structureId,
      );
      if (structure && structure.structureName) {
        currentProjectNameSpan.textContent = structure.structureName;
        projectNameDisplay.style.display = "block";
      } else {
        // This case handles if the ID is in the URL but not in the DB
        currentProjectNameSpan.textContent = "No Project Loaded";
        projectNameDisplay.style.display = "block";
      }
    } else {
      // This is the new part: handles when no project ID is in the URL
      currentProjectNameSpan.textContent = "No Project Loaded";
      projectNameDisplay.style.display = "block";
    }
  } catch (error) {
    console.error("Error updating project name display:", error);
    const projectNameDisplay = document.getElementById("project-name-display");
    if (projectNameDisplay) {
      projectNameDisplay.style.display = "none";
    }
  }
}



(window as any).saveStructure = saveStructure;
(window as any).loadStructure = loadStructure;
(window as any).pushToRemote = pushToRemote;
(window as any).pullFromRemote = pullFromRemote;
(window as any).createNewProject = createNewProject;

// Export new sync functions
(window as any).markProjectAsSynced = markProjectAsSynced;
(window as any).isProjectSynced = isProjectSynced;
(window as any).cleanupRemoteStructures = cleanupRemoteStructures;

// Call the function on page load to ensure the project name is displayed if a project is open.
document.addEventListener("DOMContentLoaded", () => {
  updateProjectNameDisplay();
});

/**
 * Marks a project as synced to the backend
 * @param localId - The local project ID
 * @param syncedProjectId - The backend synced project ID
 */
async function markProjectAsSynced(localId: string, syncedProjectId: string): Promise<void> {
  try {
    await (window as any).DexieDB.structureData.update(localId, {
      isSynced: true,
      syncedProjectId: syncedProjectId,
      isRemote: true // Mark as remote for cleanup on logout
    });
    console.log(`Project ${localId} marked as synced with backend project ${syncedProjectId}`);
  } catch (error) {
    console.error("Error marking project as synced:", error);
    throw error;
  }
}

/**
 * Checks if a project is synced to the backend
 * @param localId - The local project ID
 * @returns Promise<boolean> - True if project is synced, false otherwise
 */
async function isProjectSynced(localId: string): Promise<boolean> {
  try {
    const project = await (window as any).DexieDB.structureData.get(localId);
    return project?.isSynced || false;
  } catch (error) {
    console.error("Error checking if project is synced:", error);
    return false;
  }
}

/**
 * Cleanup function to delete all remote structures on logout
 * Deletes all structures where isRemote is true
 */
async function cleanupRemoteStructures(): Promise<void> {
  try {
    console.log("Cleaning up remote structures...");

    // Get all remote structures
    const remoteStructures = await (window as any).DexieDB.structureData
      .where('isRemote')
      .equals(true)
      .toArray();

    console.log(`Found ${remoteStructures.length} remote structures to delete`);

    // Delete each remote structure
    for (const structure of remoteStructures) {
      await (window as any).DexieDB.structureData.delete(structure.id);
      console.log(`Deleted remote structure: ${structure.structureName} (${structure.id})`);
    }

    console.log("Remote structures cleanup completed");
  } catch (error) {
    console.error("Error cleaning up remote structures:", error);
    throw error;
  }

  /**
   * Gets the synced project ID for a local project
   * @param localId - The local project ID
   * @returns Promise<string | null> - The backend synced project ID or null if not synced
   */
  async function getSyncedProjectId(localId: string): Promise<string | null> {
    try {
      const project = await (window as any).DexieDB.structureData.get(localId);
      return project?.syncedProjectId || null;
    } catch (error) {
      console.error("Error getting synced project ID:", error);
      return null;
    }
  }

  /**
   * Marks a project as not synced (useful for sync failures or manual unsync)
   * @param localId - The local project ID
   */
  async function markProjectAsUnsynced(localId: string): Promise<void> {
    try {
      await (window as any).DexieDB.structureData.update(localId, {
        isSynced: false,
        syncedProjectId: null
      });
      console.log(`Project ${localId} marked as unsynced`);
    } catch (error) {
      console.error("Error marking project as unsynced:", error);
      throw error;
    }
  }

  /**
   * Fetch remote projects and their metadata
   */
  async function fetchRemoteProjects(): Promise<any[]> {
    try {
      // Check if user is logged in
      if (!(window as any).isLoggedIn || !(window as any).isLoggedIn()) {
        return [];
      }

      // Get remote projects
      const remoteProjects = await (window as any).getRemoteStructures();
      return remoteProjects || [];
    } catch (error) {
      console.error("Error fetching remote projects:", error);
      return [];
    }
  }

  /**
   * Pull remote project to local IndexedDB
   */
  async function pullRemoteProject(remoteProject: any): Promise<boolean> {
    try {
      // Show loading indicator
      const notify = (window as any).Metro?.notify;
      if (notify) {
        notify.create("Pulling remote project...", null, {
          cls: "info",
          keepOpen: true,
          element: '#pull-notification'
        });
      }

      // Get all commits for the remote project
      const remoteCommits = await (window as any).getProjectCommits(remoteProject.id);
      if (!remoteCommits || remoteCommits.length === 0) {
        if (notify) {
          notify.create("No commits found in remote project", null, {
            cls: "warning",
            keepOpen: false
          });
        }
        return false;
      }

      // Download commit data for each commit
      const localCommits = [];
      for (const commit of remoteCommits) {
        // Get commit data
        const commitData = await (window as any).readCommitData(remoteProject.id, commit.id);
        if (!commitData) {
          if (notify) {
            notify.create(`Failed to download commit ${commit.commitName}`, null, {
              cls: "alert",
              keepOpen: false
            });
          }
          return false;
        }

        // Add to local commits array
        localCommits.push({
          commitId: commit.id,
          commitName: commit.commitName,
          data: commitData,
          parent: commit.parentCommitId || null,
          createdAt: commit.createdAt
        });
      }

      // Ensure commits are in chronological order oldest -> newest
      sortCommitsChronologically(localCommits);
      const branchesObj = reconstructBranchesFromParents(localCommits);

      // Create new local project using remote project ID as local ID
      const newProject = {
        id: remoteProject.id, // Use remote ID as local ID for consistency
        commits: localCommits,
        structureName: remoteProject.projectName,
        date: Date.now(),
        branches: Object.keys(branchesObj).length ? branchesObj : { main: localCommits.map(c => c.commitId) },
        isSynced: true,
        syncedProjectId: remoteProject.id,
        isRemote: true // Mark as remote for cleanup on logout
      };

      // Save to IndexedDB
      await (window as any).DexieDB.structureData.put(newProject);

      // Show success message
      if (notify) {
        notify.create("Remote project pulled successfully!", null, {
          cls: "success",
          keepOpen: false
        });
      }

      return true;
    } catch (error) {
      console.error("Error pulling remote project:", error);
      const notify = (window as any).Metro?.notify;
      if (notify) {
        notify.create("Failed to pull remote project", null, {
          cls: "alert",
          keepOpen: false
        });
      }
      return false;
    }
  }

}
