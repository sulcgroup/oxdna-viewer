class OrigamiStaple extends Strand {
  position: any;
  sequence: string;
  velocity: number;
  acceleration: number;
  direction: any;
  isFake: boolean;
  elements: ElementMap;

  constructor(
    id,
    system,
    sequence,
    fake = false,
    velocity = 10,
    direction = new THREE.Vector3(0, 0, 1)
  ) {
    super(id, system);
    this.position = new THREE.Vector3(0, 0, 0);
    this.sequence = sequence;
    this.velocity = velocity;
    this.acceleration = 0;
    this.direction = direction;
    this.isFake = fake;
    this.elements = new ElementMap();
    this.addNucleotides();
  }

  addNucleotides() {
    for (let i = 0; i < this.sequence.length; i++) {
      const elem = new DNANucleotide(undefined, this);
      elements.push(elem);
    }
  }

  nextPosition(delta: number) {
    this.position +=
      this.velocity * this.direction * delta +
      (0.5 * this.acceleration * delta * delta) / 2;
    this.direction.x = Math.random();
    this.direction.y = Math.random();
    this.direction.z = Math.random();
    this.direction.normalize();
    return this.position;
  }

  freeze() {
    this.velocity = 0;
    this.acceleration = 0;
  }

  boundaryBox(): THREE.Box3 {
    // TODO: This code does not work because of a type error
    // new THREE.Box3().setFromObject(this.elements);
    return new THREE.Box3();
  }

  static fake(staple, startIdx, endIdx) {
    let fakes = [];
    if (startIdx != 0 && endIdx != staple.sequence.length - 1) {
      const fakeSequence1 = staple.sequence.slice(0, startIdx);
      const fakeSequence2 = staple.sequence.slice(endIdx);
      fakes.push(
        new OrigamiStaple(staple.id, staple.system, fakeSequence1, true)
      );
      fakes.push(
        new OrigamiStaple(staple.id, staple.system, fakeSequence2, true)
      );
    } else if (startIdx != 0) {
      const fakeSequence = staple.sequence.slice(0, startIdx);
      fakes.push(
        new OrigamiStaple(staple.id, staple.system, fakeSequence, true)
      );
    } else {
      const fakeSequence = staple.sequence.slice(endIdx);
      fakes.push(
        new OrigamiStaple(staple.id, staple.system, fakeSequence, true)
      );
    }

    return fakes;
  }

  /**
   * Translate the staple by a given amount
   * @param amount Vector3 with the amount to translate the staple
   */
  translateStrand(amount: THREE.Vector3) {
    const s = this.system;
    const monomers = this.getMonomers(true);
    monomers.forEach((e) => e.translatePosition(amount));

    s.callUpdates(["instanceOffset"]);
    if (tmpSystems.length > 0) {
      tmpSystems.forEach((s) => {
        s.callUpdates(["instanceOffset"]);
      });
    }
  }
}
