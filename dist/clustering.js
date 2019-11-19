/**
 * Clear clusters and reset the cluster counter
 */
function clearClusters() {
    clusterCounter = 0; // Cluster counter
    elements.forEach(element => {
        delete element.clusterId;
    });
}
/**
 * Calculate DBSCAN clusters using parameters from input
 */
function calculateClusters() {
    const minPts = parseFloat(document.getElementById("minPts").value);
    const epsilon = parseFloat(document.getElementById("epsilon").value);
    document.getElementById("clusterOptions").hidden = true;
    // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting dbscan:
    renderer.domElement.style.cursor = "wait";
    requestAnimationFrame(() => requestAnimationFrame(function () {
        dbscan(minPts, epsilon);
        renderer.domElement.style.cursor = "auto"; // Change cursor back
        setColoringMode("Cluster");
    }));
}
/**
 * Calculate DBSCAN clusters using custom parameters
 */
// Algorithm and comments from:
// https://en.wikipedia.org/wiki/DBSCAN#Algorithm
function dbscan(minPts, eps) {
    const nElements = elements.length;
    clearClusters(); // Remove any previous clusters and reset counter
    const noise = -1; // Label for noise
    const getPos = (element) => {
        return element.getInstanceParameter3("cmOffsets");
    };
    const findNeigbours = (p, eps) => {
        const neigbours = [];
        for (let i = 0; i < nElements; i++) {
            let q = elements[i];
            if (p != q) {
                let dist = getPos(p).distanceTo(getPos(q));
                if (dist < eps) {
                    neigbours.push(q);
                }
            }
        }
        return neigbours;
    };
    for (let i = 0; i < nElements; i++) {
        let p = elements[i];
        if (typeof p.clusterId !== 'undefined') {
            continue; // Previously processed in inner loop
        }
        // Find neigbours of p:
        let neigbours = findNeigbours(p, eps);
        if (neigbours.length < minPts) { // Density check
            p.clusterId = noise; // Label as noise
            continue;
        }
        clusterCounter++; // Next cluster id
        p.clusterId = clusterCounter; // Label initial point
        for (let j = 0; j < neigbours.length; j++) { // Process every seed point
            let q = neigbours[j];
            if ((typeof q.clusterId !== 'undefined') && // Previously processed
                (q.clusterId !== noise) // If noise, change it to border point
            ) {
                continue;
            }
            q.clusterId = clusterCounter; // Label neigbour
            // Find neigbours of q:
            let metaNeighbors = findNeigbours(q, eps);
            if (metaNeighbors.length >= minPts) { // Density check
                // Add new neigbours to seed set
                neigbours = neigbours.concat(metaNeighbors);
            }
        }
    }
}
/**
 * Add all selected elements to a new cluster
 */
function selectionToCluster() {
    if (selectedBases.size > 0) {
        clusterCounter++;
        selectedBases.forEach(element => {
            element.clusterId = clusterCounter;
        });
    }
    else {
        notify("First make a selection of elements you want to include in the cluster");
    }
}
