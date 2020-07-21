// Modified from https://github.com/mburst/dijkstras-algorithm
/**
 * A node for priorioty linked list / stack and such
 */
class PriorityNode {
    constructor(key, priority) {
        this.key = key;
        this.priority = priority;
    }
}
/**
 * A priority queue with highest priority always on top
 * This queue is sorted by priority for each enqueue
 */
class PriorityQueue {
    constructor() {
        this.nodes = [];
    }
    /**
     * Enqueue a new node
     * @param {[type]} priority
     * @param {[type]} key
     */
    enqueue(priority, key) {
        this.nodes.push(new PriorityNode(key, priority));
        this.nodes.sort(function (a, b) {
            return a.priority - b.priority;
        });
    }
    /**
     * Dequeue the highest priority key
     */
    dequeue() {
        return this.nodes.shift().key;
    }
    /**
     * Checks if empty
     */
    empty() {
        return !this.nodes.length;
    }
}
/**
 * Computes the shortest path between two nodes
 */
class Dijkstra {
    /**
     * Add a new vertex and related edges
     * @param {[type]} name  [description]
     * @param {[type]} edges [description]
     */
    //	addVertex(name:string, edges:any){
    //		this.vertices[name] = edges;
    //	}
    constructor(vertices, crossPairs) {
        this.infinity = 1 / 0;
        this.vertices = vertices.map(e => e.id);
        this.crossPairs = crossPairs;
    }
    ;
    getNeigbors(id) {
        let e = elements.get(id);
        let n = [];
        if (e.n3) {
            n.push(e.n3.id);
        }
        if (e.n5) {
            n.push(e.n5.id);
        }
        if (this.crossPairs && e instanceof Nucleotide) {
            let pair = e.pair;
            if (pair) {
                n.push(pair.id);
            }
        }
        return n;
    }
    /**
     * Computes the shortest path from start to finish
     * @param start
     * @param goals
     */
    shortestPath(start, goals) {
        let nodes = new PriorityQueue(), distances = {}, previous = {}, path = [], smallest, vertex, neighbors, alt, goalLasts = [];
        goals.forEach(e => {
            goalLasts.push(e.id);
        });
        // Init the distances and queues variables
        this.vertices.forEach(vertex => {
            if (vertex === start.id) {
                distances[vertex] = 0;
                nodes.enqueue(0, vertex);
            }
            else {
                distances[vertex] = this.infinity;
                nodes.enqueue(this.infinity, vertex);
            }
            previous[vertex] = null;
        });
        // Continue as long as the queue hasn't been emptied.
        while (!nodes.empty()) {
            smallest = nodes.dequeue();
            // If we found a goal node, tick it off the list
            const index = goalLasts.indexOf(smallest, 0);
            if (index > -1) {
                goalLasts.splice(index, 1);
            }
            // If it was the last one
            if (goalLasts.length == 0) {
                //Compute the paths
                goals.forEach(e => {
                    let curr = e.id;
                    while (previous[curr]) {
                        path.push(curr);
                        curr = previous[curr];
                    }
                });
                break;
            }
            // No distance known. Skip.
            if (!smallest || distances[smallest] === this.infinity) {
                continue;
            }
            // Compute the distance for each neighbor
            neighbors = this.getNeigbors(smallest);
            neighbors.forEach(neighbor => {
                alt = distances[smallest] + 1;
                if (alt < distances[neighbor]) {
                    distances[neighbor] = alt;
                    previous[neighbor] = smallest;
                    nodes.enqueue(alt, neighbor);
                }
            });
        }
        // The starting point isn't in the solution &
        // the solution is from end to start.
        return path.concat(start.id).reverse().map(i => elements.get(i));
    }
}
