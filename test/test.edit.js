// Have a look at https://mochajs.org/

// Setup
console.log("Test Loaded");
let assert = chai.assert;
let oxview=document.getElementById("oxview").contentWindow;
let seq = "ACTGCCTAAGCCTAAG";
var compl = {A:'T',G:'C',C:'G', T:'A'}
let complseq = Array.from(seq).map(c=>compl[c]).reverse().join('');

describe('Editing', function () {
  describe('Create strand', function () {
    before(function () {
      oxview.edit.createStrand(seq);
    });
    it('should create one strand', function () {
      let systems = oxview.getSystems();
      assert(systems.length == 1);
      assert(systems[0].strands.length == 1);
    });
    it('should have the correct length', function () {
      assert(oxview.getSystems()[0].strands[0].getLength() == seq.length)
      assert(oxview.getElements().size == seq.length);
    });
    it('should have the correct sequence', function () {
      let strand = oxview.getElements().get(0).strand;
      assert(strand.getSequence() == seq);
    });
    it('should have correct endpoints', function () {
      let strand = oxview.getElements().get(0).strand;
      assert(strand.end3);
      assert(!strand.end3.n3);
      assert(!strand.end5.n5);
    });
    after(function () {
      let elems = Array.from(oxview.getElements().values());
      oxview.edit.deleteElements(elems);
    });
  });
  describe('Create duplex', function () {
    before(function () {
      oxview.edit.createStrand(seq, true);
    });
    it('should create two strands', function () {
      let systems = oxview.getSystems();
      assert(systems.length == 1);
      assert(systems[0].strands.length == 2, `${systems[0].strands.length} strands instead of 2`);
    });
    it('should have the correct lengths', function () {
      assert(oxview.getSystems()[0].strands[0].getLength() == seq.length)
      assert(oxview.getSystems()[0].strands[1].getLength() == seq.length)
      assert(oxview.getElements().size == 2*seq.length);
    });
    it('should have the correct sequence', function () {
      let strand1 = oxview.getSystems()[0].strands[0];
      let strand2 = oxview.getSystems()[0].strands[1];
      assert(strand1.getSequence() == seq);
      assert(strand2.getSequence() == complseq);
    });
    it('should have correct endpoints', function () {
      let strand1 = oxview.getSystems()[0].strands[0];
      let strand2 = oxview.getSystems()[0].strands[1];
      [strand1, strand2].forEach(strand=>{
        assert(strand.end3);
        assert(strand.end5);
        assert(!strand.end3.n3);
        assert(!strand.end5.n5);
      });
    });
    after(function () {
      let elems = Array.from(oxview.getElements().values());
      oxview.edit.deleteElements(elems);
    });
  });
  describe('Circular strands', function () {
    before(function () {
      oxview.edit.createStrand(seq);
    });
    it('should not be circular from the start', function () {
      let strand = oxview.getSystems()[0].strands[0];
      assert(!strand.isCircular());
    });
    it('should be circular after ligating the ends', function () {
      let strand = oxview.getSystems()[0].strands[0];
      oxview.edit.ligate(strand.end3, strand.end5);
      assert(strand.isCircular());
    });
    it('should not be circular after nicking', function () {
      let strand = oxview.getSystems()[0].strands[0];
      oxview.edit.nick(strand.end5);
      assert(!strand.isCircular());
    });
    it('should have correct endpoints', function () {
      let strand = oxview.getSystems()[0].strands[0];
      assert(strand.end3);
      assert(strand.end5);
      assert(!strand.end3.n3);
      assert(!strand.end5.n5);
    });

    after(function () {
      let elems = Array.from(oxview.getElements().values());
      oxview.edit.deleteElements(elems);
    });
  });
  describe('Ligation', function () {
    before(function () {
      oxview.edit.createStrand(seq, true);
    });
    it('should be two strands from the start', function () {
      assert(oxview.getSystems()[0].strands.length == 2);
    });
    it('should be one strand after ligation', function () {
      let strand1 = oxview.getSystems()[0].strands[0];
      let strand2 = oxview.getSystems()[0].strands[1];
      oxview.edit.ligate(strand1.end3, strand2.end5);
      assert(oxview.getSystems()[0].strands.length == 1);
    });
    it('should have the combinded sequence of the two strands', function () {
      let strand = oxview.getSystems()[0].strands[0];
      assert(strand.getSequence() == seq+complseq);
    });
    it('should have correct endpoints', function () {
      let strand = oxview.getSystems()[0].strands[0];
      assert(strand.end3);
      assert(strand.end5);
      assert(!strand.end3.n3);
      assert(!strand.end5.n5);
    });
    after(function () {
      let elems = Array.from(oxview.getElements().values());
      oxview.edit.deleteElements(elems);
    });
  });
  describe('Nicking', function () {
    before(function () {
      oxview.edit.createStrand(seq);
    });
    it('should be one strand from the start', function () {
      assert(oxview.getSystems()[0].strands.length == 1);
    });
    it('should be two strands after nicking', function () {
      let strand = oxview.getSystems()[0].strands[0];
      let monomers = strand.getMonomers();
      let middle = monomers[Math.round(monomers.length/2) - 1];
      oxview.edit.nick(middle);
      assert(oxview.getSystems()[0].strands.length == 2);
    });
    it('should have each half of the sequence', function () {
      let strand1 = oxview.getSystems()[0].strands[1];
      let strand2 = oxview.getSystems()[0].strands[0];
      let i = Math.round(seq.length/2);
      assert(strand1.getSequence() == seq.substr(i), `${strand1.getSequence()} is not ${seq.substr(i)}`);
      assert(strand2.getSequence() == seq.substr(0,i), `${strand1.getSequence()} is not ${seq.substr(0,i)}`);
    });
    it('should have correct endpoints', function () {
      let strand1 = oxview.getSystems()[0].strands[0];
      let strand2 = oxview.getSystems()[0].strands[1];
      [strand1, strand2].forEach(strand=>{
        assert(strand.end3);
        assert(strand.end5);
        assert(!strand.end3.n3);
        assert(!strand.end5.n5);
      });
    });
    after(function () {
      let elems = Array.from(oxview.getElements().values());
      oxview.edit.deleteElements(elems);
    });
  });
});



