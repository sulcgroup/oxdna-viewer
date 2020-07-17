function forcesToString() {
    return forces.map(f=>f.toString()).join('\n\n');
}

abstract class Force {   
    type: string;
    system: System;
    sceneObjects: THREE.Object3D[] = [];
    paramKeys: string[] = [];
    constructor(parsedjson: Object, system: System) {
        for (var param in parsedjson) {
            this[param] = parsedjson[param];
            this.paramKeys.push(param);
        }
        this.system = system;
    }

    abstract update();

    clearDrawn() {
        this.sceneObjects.forEach(o=>{
            scene.remove(o);
        });
    }

    toString(): string {
        return `{\n${this.paramKeys.map(i=>{return `${i} = ${this[i]}`}).join('\n')}\n}`;
    }
}

class MutualTrap extends Force {
    type = 'mutual_trap'
    particle: number; // the particle on which to exert the force.
    ref_particle: number; // particle to pull towards. Please note that this particle will not feel any force (the name mutual trap is thus misleading).
    stiff: number; // stiffness of the trap.
    r0: number; // equilibrium distance of the trap.
    
    equilibrium_distances : THREE.Vector3[];
    force: THREE.Vector3[];
        

    getParticle() {
        return this.system.getElementBySID(this.particle);
    }

    getRefParticle() {
        return this.system.getElementBySID(this.ref_particle);
    }

    update() {
        const p1 = this.getParticle().getInstanceParameter3("bbOffsets"); // position from which to exert the force.
        const p2 = this.getRefParticle().getInstanceParameter3("bbOffsets"); // position to pull towards.
                 
        let dir = p2.clone().sub(p1).normalize();
        
        this.equilibrium_distances = [
            p1, p1.clone().add(dir.clone().multiplyScalar(this.r0))
        ];        
        
        //draw force 
        dir = p2.clone().sub(p1);
        let force_v = dir.clone().normalize().multiplyScalar(
            (dir.length() - this.r0 )* this.stiff
        );
        dir.normalize();
        this.force = [
            p1, p1.clone().add(dir.multiplyScalar(force_v.length()))
        ];
    }
}

class ForceHandler{
    mutual_traps :MutualTrap[];
    sceneObjects: THREE.Object3D[] = [];
    constructor( mutual_traps :Force[]) {
        this.mutual_traps = <MutualTrap[]> mutual_traps;
        let v1 = [];
        let v2 = [];
        let force_geometry = new THREE.BufferGeometry();
        let equilibrium_distances_geometry = new THREE.BufferGeometry();
        
        this.mutual_traps.forEach(f => {
            v1.push(f.force[0].x,f.force[0].y,f.force[0].z );
            v1.push(f.force[1].x,f.force[1].y,f.force[1].z );
            v2.push(f.equilibrium_distances[0].x,f.equilibrium_distances[0].y,f.equilibrium_distances[0].z );
            v2.push(f.equilibrium_distances[1].x,f.equilibrium_distances[1].y,f.equilibrium_distances[1].z );
        });

        force_geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( v1, 3 ) );
        let material = new THREE.LineBasicMaterial( { color: 0xC0C0C0, opacity:1, linewidth: 10 } );
        let force_lines = new THREE.LineSegments( force_geometry, material );
        scene.add(force_lines);
        this.sceneObjects.push(force_lines);
        
        equilibrium_distances_geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( v2, 3 ) );
        material = new THREE.LineBasicMaterial( { color: 0x0000ff, opacity:1 } );
        let equilibrium_distances_lines = new THREE.LineSegments( equilibrium_distances_geometry, material );
        scene.add(equilibrium_distances_lines);
        this.sceneObjects.push(equilibrium_distances_lines);
    }
    clearDrawn(){
        this.sceneObjects.forEach(
            o =>{
                scene.remove(o);
            }
        );
    }
}