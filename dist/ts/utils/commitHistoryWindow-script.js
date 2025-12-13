/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />
// This script is loaded when the commit history modal is opened.
console.log("commitHistoryWindow-script.ts: Script loaded.");
async function initCommitHistory(structureId) {
    console.log("initCommitHistory: Starting function.");
    // Wait for the element to be available
    let commitGraphElement = document.getElementById('commit-graph');
    if (!commitGraphElement) {
        console.log('initCommitHistory: Waiting for commit-graph element...');
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 100));
        commitGraphElement = document.getElementById('commit-graph');
        if (!commitGraphElement) {
            console.error('initCommitHistory ERROR: Could not find commit-graph element. Aborting.');
            return;
        }
    }
    commitGraphElement.innerHTML = '<p>Loading commit history from script...</p>';
    console.log("initCommitHistory: Found commit-graph element.", commitGraphElement);
    const urlParams = new URLSearchParams(window.location.search);
    if (!structureId) {
        structureId = urlParams.get("structureId");
    }
    console.log(`initCommitHistory: URL structureId = '${structureId}'`);
    if (!structureId) {
        console.error("initCommitHistory ERROR: structureId parameter not found in URL.");
        commitGraphElement.innerHTML = '<p>Error: structureId not found in URL.</p>';
        return;
    }
    let structure;
    try {
        structure = await window.DexieDB.structureData.get(structureId);
        console.log("initCommitHistory: DexieDB.structureData.get call returned.", structure);
    }
    catch (e) {
        console.error("initCommitHistory ERROR: Failed to get structure from DexieDB.", e);
        commitGraphElement.innerHTML = `<p>Error: Could not retrieve structure data.</p>`;
        return;
    }
    if (!structure || !structure.commits || !Array.isArray(structure.commits)) { // Updated to use 'commits'
        console.error(`initCommitHistory ERROR: Structure with id ${structureId} not found or is malformed.`, structure);
        commitGraphElement.innerHTML = `<p>Error: Structure with id ${structureId} not found or is invalid.</p>`;
        return;
    }
    console.log("initCommitHistory: Successfully retrieved structure:", structure);
    // Ensure commits are processed chronologically (oldest -> newest)
    const commitsSorted = structure.commits.slice();
    commitsSorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const currentBranchName = urlParams.get('branch') || 'main';
    console.log(`initCommitHistory: Current branch name is '${currentBranchName}'`);
    // Create a map for quick commit lookup and to store children
    const commitMap = new Map();
    console.log("initCommitHistory: Building commit map...");
    commitsSorted.forEach(commit => {
        if (!commit.commitId) {
            console.warn("initCommitHistory WARNING: Found a commit without a commitId.", commit);
            return;
        }
        commitMap.set(commit.commitId, { commit, children: [] });
    });
    console.log("initCommitHistory: Commit map built.", commitMap);
    // Populate children for each commit node
    console.log("initCommitHistory: Building parent-child relationships...");
    commitsSorted.forEach(commit => {
        if (commit.parent) {
            const parentNode = commitMap.get(commit.parent);
            if (parentNode) {
                const currentNode = commitMap.get(commit.commitId);
                if (currentNode) {
                    parentNode.children.push(currentNode);
                }
                else {
                    console.warn(`initCommitHistory WARNING: Child commit with id ${commit.commitId} not found in commitMap.`);
                }
            }
            else {
                console.warn(`initCommitHistory WARNING: Parent commit with id ${commit.parent} not found in commitMap.`);
            }
        }
    });
    console.log("initCommitHistory: Parent-child relationships built.");
    // Find root commits (those without parents in the structure)
    const rootNodes = commitsSorted // Updated to use 'commits'
        .filter(commit => !commit.parent || !commitMap.has(commit.parent))
        .map(commit => commitMap.get(commit.commitId)).filter(node => node); // ensure no undefined nodes
    console.log("initCommitHistory: Found root nodes:", rootNodes);
    // Create branch head map for easy lookup
    const branchHeads = new Map();
    if (structure.branches) {
        for (const branchName in structure.branches) {
            const commitIds = structure.branches[branchName];
            if (commitIds && commitIds.length > 0) {
                branchHeads.set(commitIds[commitIds.length - 1], branchName);
            }
        }
    }
    console.log("initCommitHistory: Branch heads map:", branchHeads);
    // Render the commit graph
    console.log("initCommitHistory: Starting render process...");
    commitGraphElement.innerHTML = ''; // Clear existing content
    const graphContainer = document.createElement('div');
    graphContainer.classList.add('commit-graph-container');
    const style = document.createElement('style');
    style.textContent = `
        .commit-graph-container {
            font-family: sans-serif;
            padding: 10px;
        }
        .commit-node {
            margin-left: 20px;
            border-left: 2px solid #ccc;
            padding-left: 15px;
            position: relative;
        }
        .commit-node::before {
            content: '';
            position: absolute;
            left: -9px;
            top: 5px;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            background-color: #3498db;
            border: 2px solid #fff;
            z-index: 1;
        }
        .commit-details {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            padding: 5px;
        }
        .commit-link {
            color: #333;
            text-decoration: none;
        }
        .commit-link:hover {
            text-decoration: underline;
        }
        .branch-label {
            background-color: #2ecc71;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-left: 10px;
        }
        .current-branch-label {
            background-color: #e67e22;
        }
        .share-link {
            color: #27ae60;
            text-decoration: none;
            margin-left: 10px;
            font-size: 0.8em;
        }
        .share-link:hover {
            text-decoration: underline;
        }
    `;
    commitGraphElement.appendChild(style);
    function renderTree(nodes, container) {
        console.log("renderTree: Rendering nodes:", nodes);
        if (nodes.length === 0) {
            console.log("renderTree: No nodes to render in this subtree.");
        }
        nodes.forEach(node => {
            console.log(`renderTree: Processing node ${node.commit.commitId} ('${node.commit.commitName}')`);
            const nodeDiv = document.createElement('div');
            nodeDiv.classList.add('commit-node');
            const detailsDiv = document.createElement('div');
            detailsDiv.classList.add('commit-details');
            const commitLink = document.createElement('a');
            commitLink.classList.add('commit-link');
            commitLink.href = `/?structureId=${structureId}&commit=${node.commit.commitId}&load=true`;
            commitLink.textContent = node.commit.commitName;
            commitLink.title = `Commit ID: ${node.commit.commitId}`;
            detailsDiv.appendChild(commitLink);
            if (branchHeads.has(node.commit.commitId)) {
                const branchName = branchHeads.get(node.commit.commitId);
                const branchLabel = document.createElement('span');
                branchLabel.classList.add('branch-label');
                branchLabel.textContent = branchName;
                if (branchName === currentBranchName) {
                    branchLabel.classList.add('current-branch-label');
                }
                detailsDiv.appendChild(branchLabel);
                console.log(`renderTree: Added branch label '${branchName}' to commit ${node.commit.commitId}`);
            }
            // Always add a "Share" link that opens the popup, regardless of share status
            const shareLink = document.createElement('a');
            shareLink.classList.add('share-link');
            shareLink.href = '#';
            shareLink.textContent = 'Share';
            if (node.commit.shareInfo) {
                shareLink.title = `Shared on ${new Date(node.commit.shareInfo.createdAt).toLocaleDateString()}`;
            }
            else {
                shareLink.title = 'Generate shareable link';
            }
            shareLink.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleCommitShareWithPopup(structureId, node.commit);
            });
            detailsDiv.appendChild(shareLink);
            nodeDiv.appendChild(detailsDiv);
            if (node.children.length > 0) {
                console.log(`renderTree: Node ${node.commit.commitId} has ${node.children.length} children. Descending.`);
                renderTree(node.children, nodeDiv);
            }
            container.appendChild(nodeDiv);
        });
    }
    if (rootNodes.length === 0) {
        console.error("initCommitHistory ERROR: No root nodes found. The commit history may be cyclic or empty. Cannot render tree.");
        commitGraphElement.innerHTML = '<p>Error: No root commits found. Unable to render history tree.</p>';
    }
    else {
        renderTree(rootNodes, graphContainer);
        commitGraphElement.appendChild(graphContainer);
        console.log("initCommitHistory: Render process complete.");
    }
}
// Function to handle sharing for a specific commit and return share info
async function generateShareInfo(structureId, commit) {
    try {
        // Get the structure to access its name
        const structure = await window.DexieDB.structureData.get(structureId);
        if (!structure) {
            throw new Error("Structure not found");
        }
        // Convert ArrayBuffer to base64 string
        const uint8Array = new Uint8Array(commit.data);
        const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
        const base64Data = btoa(binaryString);
        const requestBody = {
            structureName: structure.structureName,
            commit: {
                commitId: commit.commitId,
                commitName: commit.commitName,
                data: base64Data,
                parent: commit.parent
            }
        };
        // Use the new shareCommit API function
        const result = await shareCommit(requestBody);
        if (!result) {
            throw new Error("Failed to share commit");
        }
        // Construct the full shareable URL
        const baseUrl = window.location.origin;
        const shareUrl = result.shareUrl || `${baseUrl}/shared?shareId=${result.shareId}`;
        const shareInfo = {
            shareUrl: shareUrl,
            shareId: result.shareId,
            createdAt: new Date(result.createdAt || Date.now()),
            expiresAt: new Date(result.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
        };
        // Update the commit with share info and save to database
        commit.shareInfo = shareInfo;
        await updateCommitShareInfo(structureId, commit.commitId, shareInfo);
        return shareInfo;
    }
    catch (error) {
        console.error("Error generating permanent link:", error);
        throw error;
    }
}
// Function to handle sharing for a specific commit and show popup
async function handleCommitShareWithPopup(structureId, commit) {
    try {
        // If already shared, use existing shareInfo, else generate
        let shareInfo = commit.shareInfo;
        if (!shareInfo) {
            // Show loading state (optional: could show spinner, but not clearing UI)
            shareInfo = await generateShareInfo(structureId, commit);
        }
        const shareUrl = shareInfo.shareUrl;
        if (!shareUrl) {
            throw new Error("Failed to generate share URL");
        }
        // Create popup element
        const popup = document.createElement('div');
        popup.id = 'share-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 90%;
            width: 400px;
            text-align: center;
        `;
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        `;
        // Create content
        const content = document.createElement('div');
        content.innerHTML = `
            <h3>Share Link</h3>
            <p>Your share link:</p>
            <input type="text" id="share-url-input" value="${shareUrl}" readonly style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;">
            <button id="copy-button" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy to Clipboard</button>
            <button id="close-button" style="margin-left: 10px; padding: 8px 16px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
        `;
        popup.appendChild(content);
        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        // Add event listeners
        const copyButton = popup.querySelector('#copy-button');
        const closeButton = popup.querySelector('#close-button');
        const inputField = popup.querySelector('#share-url-input');
        copyButton.addEventListener('click', () => {
            inputField.select();
            try {
                navigator.clipboard.writeText(inputField.value).then(() => {
                    // Visual feedback
                    const originalText = copyButton.textContent;
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = originalText;
                    }, 2000);
                });
            }
            catch (err) {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                document.execCommand('copy');
            }
        });
        closeButton.addEventListener('click', () => {
            document.body.removeChild(popup);
            document.body.removeChild(overlay);
        });
        // Close popup when clicking outside
        overlay.addEventListener('click', () => {
            document.body.removeChild(popup);
            document.body.removeChild(overlay);
        });
    }
    catch (error) {
        console.error("Error generating permanent link:", error);
        alert("Failed to generate permanent link. Please try again.");
    }
}
async function updateCommitShareInfo(structureId, commitId, shareInfo) {
    try {
        const structure = await window.DexieDB.structureData.get(structureId);
        if (!structure)
            return;
        // Find and update the specific commit
        const commitIndex = structure.commits.findIndex((c) => c.commitId === commitId); // Updated to use 'commits'
        if (commitIndex !== -1) {
            structure.commits[commitIndex].shareInfo = shareInfo; // Updated to use 'commits'
            await window.DexieDB.structureData.put(structure);
        }
    }
    catch (error) {
        console.error("Error updating commit share info:", error);
    }
}
// Don't auto-initialize, wait for the modal to be opened
// initCommitHistory();
// Export the function for manual initialization
window.initCommitHistory = initCommitHistory;
