class OrigamiScaffold extends Strand {
  attach(staple: OrigamiStaple, startIdx: number, endIdx: number): void {}

  boundaryBox(): THREE.Box3 {
    return new THREE.Box3();
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
