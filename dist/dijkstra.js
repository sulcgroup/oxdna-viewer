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
 * Computes the shortest path between two node
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
        this.vertices = vertices;
        this.crossPairs = crossPairs;
    }
    ;
    getNeigbors(e) {
        let n = [];
        if (e.neighbor3) {
            n.push(e.neighbor3);
        }
        if (e.neighbor5) {
            n.push(e.neighbor5);
        }
        if (this.crossPairs && e instanceof Nucleotide) {
            let pair = e.pair;
            if (pair) {
                n.push(pair);
            }
        }
        return n;
    }
    /**
     * Computes the shortest path from start to finish
     * @param {[type]} start  [description]
     * @param {[type]} finish [description]
     */
    shortestPath(start, goals) {
        let nodes = new PriorityQueue(), distances = {}, previous = {}, path = [], smallest, vertex, neighbors, alt, goalLasts = [];
        goals.forEach(e => {
            goalLasts.push(e.gid);
        });
        //Init the distances and queues variables
        for (vertex in this.vertices) {
            if (vertex === start.name) {
                distances[vertex] = 0;
                nodes.enqueue(0, parseInt(vertex));
            }
            else {
                distances[vertex] = this.infinity;
                nodes.enqueue(this.infinity, vertex);
            }
            previous[vertex] = null;
        }
        //continue as long as the queue haven't been emptied.
        while (!nodes.empty()) {
            smallest = nodes.dequeue();
            // If we found a goal node, tick it off the list
            const index = goalLasts.indexOf(parseInt(smallest), 0);
            if (index > -1) {
                goalLasts.splice(index, 1);
            }
            // If it was the last one
            if (goalLasts.length == 0) {
                //Compute the paths
                goals.forEach(e => {
                    let curr = e.name;
                    while (previous[curr]) {
                        path.push(curr);
                        curr = previous[curr];
                    }
                });
                break;
            }
            //No distance known. Skip.
            if (!smallest || distances[smallest] === this.infinity) {
                continue;
            }
            //Compute the distance for each neighbor
            neighbors = this.getNeigbors(this.vertices[smallest]);
            neighbors.forEach(neighbor => {
                alt = distances[smallest] + 1; //this.vertices[smallest][neighbor];
                if (alt < distances[neighbor.name]) {
                    distances[neighbor.name] = alt;
                    previous[neighbor.name] = smallest;
                    nodes.enqueue(alt, neighbor.gid);
                }
            });
        }
        //the starting point isn't in the solution & 
        //the solution is from end to start.
        return path.concat(start.gid).reverse();
    }
}
//let graph:Dijkstra = new Dijkstra(e);
//graph.addVertex('A', { B: 7, C: 8 });
//graph.addVertex('C', { A: 8 });
//graph.addVertex('B', { A: 7, F: 8 });
//graph.addVertex('F', { B: 8 });
//console.log(graph.shortestPath('A', 'F'));
