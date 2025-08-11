/// <reference path="../typescript_definitions/oxView.d.ts" />
console.log("branchSelectionWindow-script.ts: Script loaded.");
let selectedCommit = null;
let currentStructure = null;
async function initBranchSelection(structureId) {
    console.log("initBranchSelection: Starting function.");
    // Wait for the element to be available
    let branchGraphElement = document.getElementById('branch-selection-graph');
    if (!branchGraphElement) {
        console.log('initBranchSelection: Waiting for branch-selection-graph element...');
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 100));
        branchGraphElement = document.getElementById('branch-selection-graph');
        if (!branchGraphElement) {
            console.error('initBranchSelection ERROR: Could not find branch-selection-graph element. Aborting.');
            return;
        }
    }
    branchGraphElement.innerHTML = '<p>Loading branches and commits...</p>';
    // Try to get structure ID from global variable first (set by library.ts)
    if (!structureId) {
        structureId = window.branchSelectionStructureId;
    }
    // Fallback to URL params
    if (!structureId) {
        const urlParams = new URLSearchParams(window.location.search);
        structureId = urlParams.get("structureId") || undefined;
    }
    if (!structureId) {
        console.error("initBranchSelection ERROR: structureId parameter not found.");
        branchGraphElement.innerHTML = '<p>Error: structureId not found.</p>';
        return;
    }
    try {
        currentStructure = await window.DexieDB.structureData.get(structureId);
        console.log("initBranchSelection: Retrieved structure:", currentStructure);
    }
    catch (e) {
        console.error("initBranchSelection ERROR: Failed to get structure from DexieDB.", e);
        branchGraphElement.innerHTML = `<p>Error: Could not retrieve structure data.</p>`;
        return;
    }
    if (!currentStructure || !currentStructure.structure || !Array.isArray(currentStructure.structure)) {
        console.error(`initBranchSelection ERROR: Structure with id ${structureId} not found or is malformed.`);
        branchGraphElement.innerHTML = `<p>Error: Structure with id ${structureId} not found or is invalid.</p>`;
        return;
    }
    renderBranchSelection();
    setupEventListeners();
}
function renderBranchSelection() {
    if (!currentStructure)
        return;
    const branchGraphElement = document.getElementById('branch-selection-graph');
    if (!branchGraphElement)
        return;
    // Create a map for quick commit lookup and to store children
    const commitMap = new Map();
    currentStructure.structure.forEach(commit => {
        if (!commit.commitId)
            return;
        commitMap.set(commit.commitId, { commit, children: [] });
    });
    // Populate children for each commit node
    currentStructure.structure.forEach(commit => {
        if (commit.parent) {
            const parentNode = commitMap.get(commit.parent);
            if (parentNode) {
                const currentNode = commitMap.get(commit.commitId);
                if (currentNode) {
                    parentNode.children.push(currentNode);
                }
            }
        }
    });
    // Find root commits
    const rootNodes = currentStructure.structure
        .filter(commit => !commit.parent || !commitMap.has(commit.parent))
        .map(commit => commitMap.get(commit.commitId))
        .filter(node => node);
    // Create branch head map for easy lookup
    const branchHeads = new Map();
    if (currentStructure.branches) {
        for (const branchName in currentStructure.branches) {
            const commitIds = currentStructure.branches[branchName];
            if (commitIds && commitIds.length > 0) {
                branchHeads.set(commitIds[commitIds.length - 1], branchName);
            }
        }
    }
    // Clear and render
    branchGraphElement.innerHTML = '';
    const graphContainer = document.createElement('div');
    graphContainer.classList.add('branch-tree-container');
    function renderTree(nodes, container) {
        nodes.forEach(node => {
            const nodeDiv = document.createElement('div');
            nodeDiv.classList.add('commit-node');
            nodeDiv.dataset.commitId = node.commit.commitId;
            if (node.commit.shareInfo) {
                nodeDiv.classList.add('has-share-link');
            }
            const detailsDiv = document.createElement('div');
            detailsDiv.classList.add('commit-details');
            const infoDiv = document.createElement('div');
            infoDiv.classList.add('commit-info');
            const nameDiv = document.createElement('div');
            nameDiv.classList.add('commit-name');
            nameDiv.textContent = node.commit.commitName;
            infoDiv.appendChild(nameDiv);
            const idDiv = document.createElement('div');
            idDiv.classList.add('commit-id');
            idDiv.textContent = `ID: ${node.commit.commitId.substring(0, 8)}...`;
            infoDiv.appendChild(idDiv);
            detailsDiv.appendChild(infoDiv);
            // Add branch label if this is a branch head
            if (branchHeads.has(node.commit.commitId)) {
                const branchName = branchHeads.get(node.commit.commitId);
                const branchLabel = document.createElement('span');
                branchLabel.classList.add('branch-label');
                branchLabel.textContent = branchName;
                detailsDiv.appendChild(branchLabel);
            }
            // Add share indicator if this commit has been shared
            if (node.commit.shareInfo) {
                const shareIndicator = document.createElement('span');
                shareIndicator.classList.add('share-indicator');
                shareIndicator.textContent = 'Shared';
                shareIndicator.title = `Shared on ${new Date(node.commit.shareInfo.createdAt).toLocaleDateString()}`;
                detailsDiv.appendChild(shareIndicator);
            }
            nodeDiv.appendChild(detailsDiv);
            // Add click listener for selection
            nodeDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectCommit(node.commit, nodeDiv);
            });
            if (node.children.length > 0) {
                renderTree(node.children, nodeDiv);
            }
            container.appendChild(nodeDiv);
        });
    }
    if (rootNodes.length === 0) {
        branchGraphElement.innerHTML = '<p>No commits found.</p>';
    }
    else {
        renderTree(rootNodes, graphContainer);
        branchGraphElement.appendChild(graphContainer);
    }
}
function selectCommit(commit, nodeElement) {
    // Remove previous selection
    document.querySelectorAll('.commit-node.selected').forEach(node => {
        node.classList.remove('selected');
    });
    // Add selection to current node
    nodeElement.classList.add('selected');
    selectedCommit = commit;
    // Enable generate button
    const generateBtn = document.getElementById('generate-link-btn');
    if (generateBtn) {
        generateBtn.disabled = false;
        // Update button text based on whether this commit already has a share link
        if (commit.shareInfo) {
            generateBtn.textContent = 'Copy Existing Link';
        }
        else {
            generateBtn.textContent = 'Generate Link';
        }
    }
    console.log("Selected commit:", commit);
}
function setupEventListeners() {
    const cancelBtn = document.getElementById('cancel-share-btn');
    const generateBtn = document.getElementById('generate-link-btn');
    const copyBtn = document.getElementById('copy-link-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            view.closeWindow('branchSelectionWindow');
        });
    }
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerateLink);
    }
    if (copyBtn) {
        copyBtn.addEventListener('click', copyShareLink);
    }
}
async function handleGenerateLink() {
    if (!selectedCommit || !currentStructure) {
        console.error("No commit selected or structure not loaded");
        return;
    }
    const generateBtn = document.getElementById('generate-link-btn');
    const shareResult = document.getElementById('share-result');
    if (!generateBtn || !shareResult)
        return;
    // If commit already has a share link, just display it
    if (selectedCommit.shareInfo) {
        displayShareResult(selectedCommit.shareInfo.shareUrl, selectedCommit.shareInfo.expiresAt);
        return;
    }
    // Show loading state
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    try {
        const shareInfo = await generatePermanentLink(selectedCommit, currentStructure);
        // Update the commit with share info and save to database
        selectedCommit.shareInfo = shareInfo;
        await updateCommitShareInfo(currentStructure.id, selectedCommit.commitId, shareInfo);
        displayShareResult(shareInfo.shareUrl, shareInfo.expiresAt);
        // Update the UI to show this commit now has a share link
        const selectedNode = document.querySelector(`[data-commit-id="${selectedCommit.commitId}"]`);
        if (selectedNode) {
            selectedNode.classList.add('has-share-link');
            const shareIndicator = document.createElement('span');
            shareIndicator.classList.add('share-indicator');
            shareIndicator.textContent = 'Shared';
            shareIndicator.title = `Shared on ${new Date(shareInfo.createdAt).toLocaleDateString()}`;
            const detailsDiv = selectedNode.querySelector('.commit-details');
            if (detailsDiv) {
                detailsDiv.appendChild(shareIndicator);
            }
        }
    }
    catch (error) {
        console.error("Error generating permanent link:", error);
        alert("Failed to generate permanent link. Please try again.");
    }
    finally {
        generateBtn.disabled = false;
        generateBtn.textContent = selectedCommit.shareInfo ? 'Copy Existing Link' : 'Generate Link';
    }
}
async function generatePermanentLink(commit, structure) {
    const apiRoot = window.apiRoot;
    // Convert ArrayBuffer to base64 string
    const uint8Array = new Uint8Array(commit.data);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const base64Data = btoa(binaryString);
    const requestBody = {
        structureData: {
            structureName: structure.structureName,
            commit: {
                commitId: commit.commitId,
                commitName: commit.commitName,
                data: base64Data,
                parent: commit.parent
            },
            metadata: {
                createdAt: new Date()
            }
        }
    };
    const response = await fetch(`${apiRoot}/oxview/share`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    // Construct the full shareable URL
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/?shared=${result.shareId}`;
    return {
        shareUrl: shareUrl,
        shareId: result.shareId,
        createdAt: new Date(result.createdAt || Date.now()),
        expiresAt: new Date(result.expiresAt)
    };
}
async function updateCommitShareInfo(structureId, commitId, shareInfo) {
    try {
        const structure = await window.DexieDB.structureData.get(structureId);
        if (!structure)
            return;
        // Find and update the specific commit
        const commitIndex = structure.structure.findIndex((c) => c.commitId === commitId);
        if (commitIndex !== -1) {
            structure.structure[commitIndex].shareInfo = shareInfo;
            await window.DexieDB.structureData.put(structure);
        }
    }
    catch (error) {
        console.error("Error updating commit share info:", error);
    }
}
function displayShareResult(shareUrl, expiresAt) {
    const shareResult = document.getElementById('share-result');
    const shareLinkInput = document.getElementById('share-link-input');
    const expirationDate = document.getElementById('expiration-date');
    if (shareResult && shareLinkInput && expirationDate) {
        shareLinkInput.value = shareUrl;
        expirationDate.textContent = new Date(expiresAt).toLocaleDateString();
        shareResult.classList.remove('hidden');
    }
}
function copyShareLink() {
    const shareLinkInput = document.getElementById('share-link-input');
    if (shareLinkInput) {
        shareLinkInput.select();
        document.execCommand('copy');
        const copyBtn = document.getElementById('copy-link-btn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }
    }
}
// Don't auto-initialize, wait for the modal to be opened
// initBranchSelection();
// Export the function for manual initialization
window.initBranchSelection = initBranchSelection;
window.copyShareLink = copyShareLink;
// Make functions available globally for the window system
window.initBranchSelection = initBranchSelection;
