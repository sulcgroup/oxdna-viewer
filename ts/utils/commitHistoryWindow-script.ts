/// <reference path="../typescript_definitions/oxView.d.ts" />

// This script is loaded when the commit history modal is opened.
console.log("commitHistoryWindow-script.ts: Script loaded.");

interface Commit {
    commitId: string;
    commitName: string;
    parent: string | null;
    data?: any;
}

interface Structure {
    id: string;
    structure: Commit[];
    branches: { [key: string]: string[] };
    structureName: string;
    date: number;
}

interface CommitNode {
    commit: Commit;
    children: CommitNode[];
}

async function initCommitHistory(structureId?: string) {
    console.log("initCommitHistory: Starting function.");
    const commitGraphElement = document.getElementById('commit-graph');
    if (!commitGraphElement) {
        console.error('initCommitHistory ERROR: Could not find commit-graph element. Aborting.');
        return;
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

    let structure: Structure;
    try {
        structure = await (window as any).DexieDB.structureData.get(structureId);
        console.log("initCommitHistory: DexieDB.structureData.get call returned.", structure);
    } catch (e) {
        console.error("initCommitHistory ERROR: Failed to get structure from DexieDB.", e);
        commitGraphElement.innerHTML = `<p>Error: Could not retrieve structure data.</p>`;
        return;
    }

    if (!structure || !structure.structure || !Array.isArray(structure.structure)) {
        console.error(`initCommitHistory ERROR: Structure with id ${structureId} not found or is malformed.`, structure);
        commitGraphElement.innerHTML = `<p>Error: Structure with id ${structureId} not found or is invalid.</p>`;
        return;
    }
    console.log("initCommitHistory: Successfully retrieved structure:", structure);

    const currentBranchName = urlParams.get('branch') || 'main';
    console.log(`initCommitHistory: Current branch name is '${currentBranchName}'`);

    // Create a map for quick commit lookup and to store children
    const commitMap = new Map<string, CommitNode>();
    console.log("initCommitHistory: Building commit map...");
    structure.structure.forEach(commit => {
        if (!commit.commitId) {
            console.warn("initCommitHistory WARNING: Found a commit without a commitId.", commit);
            return;
        }
        commitMap.set(commit.commitId, { commit, children: [] });
    });
    console.log("initCommitHistory: Commit map built.", commitMap);

    // Populate children for each commit node
    console.log("initCommitHistory: Building parent-child relationships...");
    structure.structure.forEach(commit => {
        if (commit.parent) {
            const parentNode = commitMap.get(commit.parent);
            if (parentNode) {
                const currentNode = commitMap.get(commit.commitId);
                if (currentNode) {
                    parentNode.children.push(currentNode);
                } else {
                    console.warn(`initCommitHistory WARNING: Child commit with id ${commit.commitId} not found in commitMap.`);
                }
            } else {
                console.warn(`initCommitHistory WARNING: Parent commit with id ${commit.parent} not found in commitMap.`);
            }
        }
    });
    console.log("initCommitHistory: Parent-child relationships built.");

    // Find root commits (those without parents in the structure)
    const rootNodes = structure.structure
        .filter(commit => !commit.parent || !commitMap.has(commit.parent))
        .map(commit => commitMap.get(commit.commitId)!
        ).filter(node => node); // ensure no undefined nodes
    console.log("initCommitHistory: Found root nodes:", rootNodes);

    // Create branch head map for easy lookup
    const branchHeads = new Map<string, string>();
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
    `;
    commitGraphElement.appendChild(style);

    function renderTree(nodes: CommitNode[], container: HTMLElement) {
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
                const branchName = branchHeads.get(node.commit.commitId)!;
                const branchLabel = document.createElement('span');
                branchLabel.classList.add('branch-label');
                branchLabel.textContent = branchName;
                if (branchName === currentBranchName) {
                    branchLabel.classList.add('current-branch-label');
                }
                detailsDiv.appendChild(branchLabel);
                console.log(`renderTree: Added branch label '${branchName}' to commit ${node.commit.commitId}`);
            }

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
    } else {
        renderTree(rootNodes, graphContainer);
        commitGraphElement.appendChild(graphContainer);
        console.log("initCommitHistory: Render process complete.");
    }
}

initCommitHistory();
