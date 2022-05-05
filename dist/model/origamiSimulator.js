class OrigamiSimulator {
    staples;
    scaffold;
    threshold;
    constructor(staples, scaffold, threshold = 10) {
        this.staples = staples;
        this.scaffold = scaffold;
        this.threshold = threshold;
    }
    activateKinetics(duration, delta) {
        for (let i = 0; i < duration; i += delta) {
            let _ = this.staples.map((staple) => staple.nextPosition(delta));
            let stapleBoundaryBoxes = this.staples.map((staple) => staple.boundaryBox());
            for (let j = 0; j < stapleBoundaryBoxes.length; j++) {
                if (this.boundaryBoxViolation(stapleBoundaryBoxes[j], this.scaffold.boundaryBox())) {
                    let staple = this.staples[j];
                    let { nucleotides, startIdx, endIdx } = this.attachedNucleotides(staple);
                    if (nucleotides.length > this.threshold) {
                        this.scaffold.attach(staple, startIdx, endIdx);
                        staple.freeze();
                        this.staples.concat(OrigamiStaple.fake(staple, startIdx, endIdx));
                    }
                }
            }
            if (this.staples.filter((staple) => staple.velocity > 0)) {
                return;
            }
        }
    }
    deactivateKinetics() { }
    boundaryBoxViolation(bb1, bb2) {
        return false;
    }
    attachedNucleotides(staple) {
        return { nucleotides: [], startIdx: 0, endIdx: 0 };
    }
}
