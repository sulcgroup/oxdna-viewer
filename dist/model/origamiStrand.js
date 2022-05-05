class OrigamiStrand extends Strand {
    constructor(id, system, velocity=10, direction=THREE.Vector3(0, 0, 1)) {
        super(id, system);
        this.velocity = velocity;
        this.direction = direction;
    }
}