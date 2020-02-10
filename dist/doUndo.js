class EditHistory {
    constructor() {
        this.undoStack = new Stack();
        this.redoStack = new Stack();
    }
    ;
    /**
     * Performs revertable edit and add it to the undo history stack
     * @param edit object describing the revertable edit.
     */
    do(edit) {
        edit.redo();
        this.undoStack.push(edit);
        // We no longer care about the alternate future:
        this.redoStack = new Stack();
        // Update the hierarchy, since we've made changes
        drawHierarchy();
        //Return focus to the canvas so undo can be called immediatley
        canvas.focus();
    }
    /**
     * Add revertable edit to the undo history stack without performing it.
     * @param edit object describing the revertable edit.
     */
    add(edit) {
        this.undoStack.push(edit);
        // Update the hierarchy, since we've made changes
        drawHierarchy();
    }
    undo() {
        let edit;
        try {
            edit = this.undoStack.pop();
        }
        catch (e) {
            return; // Cannot undo any further
        }
        edit.undo();
        this.redoStack.push(edit);
        // Update the hierarchy, since we've made changes
        drawHierarchy();
    }
    redo() {
        let edit;
        try {
            edit = this.redoStack.pop();
        }
        catch (e) {
            return; // Cannot undo any further
        }
        edit.redo();
        this.undoStack.push(edit);
        // Update the hierarchy, since we've made changes
        drawHierarchy();
    }
}
class RevertableEdit {
    /**
     * Takes undo and redo functions as arguments.
     * @param undo function that, when applied, will revert the edit
     * @param redo function that, when applied, will perform the edit
     */
    constructor(undo, redo) {
        this.undo = undo;
        this.redo = redo;
    }
    ;
}
class RevertableAddition extends RevertableEdit {
    constructor(saved, added, pos) {
        const s = saved;
        let a = added;
        const p = pos;
        let undo = function () { api.deleteElements(a); };
        let redo = function () { a = api.addElementsAt(s, p); };
        super(undo, redo);
    }
    ;
}
class RevertableDeletion extends RevertableEdit {
    constructor(victims) {
        const saved = victims.map(e => new InstanceCopy(e));
        let undo = function () { this.victims = api.addElements(saved); };
        let redo = function () { api.deleteElements(this.victims); };
        super(undo, redo);
        this.victims = victims;
    }
    ;
}
class RevertableNick extends RevertableEdit {
    constructor(element) {
        const gid1 = element.gid;
        const gid2 = element.neighbor3.gid;
        let undo = function () { api.ligate(elements.get(gid1), elements.get(gid2)); };
        let redo = function () { api.nick(elements.get(gid1)); };
        super(undo, redo);
    }
    ;
}
class RevertableLigation extends RevertableEdit {
    constructor(e1, e2) {
        const gid1 = e1.gid;
        const gid2 = e2.gid;
        let undo = function () { api.nick(elements.get(gid1)); };
        let redo = function () { api.ligate(elements.get(gid1), elements.get(gid2)); };
        super(undo, redo);
    }
    ;
}
class RevertableSequenceEdit extends RevertableEdit {
    constructor(elems, sequence, setComplementaryBases) {
        const oldseq = api.getSequence(elems);
        let undo = function () { api.setSequence(elems, oldseq, setComplementaryBases); };
        let redo = function () { api.setSequence(elems, sequence, setComplementaryBases); };
        super(undo, redo);
    }
    ;
}
class RevertableTranslation extends RevertableEdit {
    constructor(translatedElements, translationVector) {
        const elements = new Set(translatedElements);
        const v = translationVector.clone();
        let undo = function () {
            translateElements(elements, v.clone().negate());
        };
        let redo = function () {
            translateElements(elements, v);
        };
        super(undo, redo);
    }
    ;
}
class RevertableRotation extends RevertableEdit {
    constructor(rotatedElements, axis, angle, about) {
        const elements = new Set(rotatedElements);
        const c = about.clone();
        let undo = function () {
            rotateElements(elements, axis, -1 * angle, c);
        };
        let redo = function () {
            rotateElements(elements, axis, angle, c);
        };
        super(undo, redo);
    }
    ;
}
class RevertableClusterSim extends RevertableEdit {
    constructor(clusters) {
        let cs = [];
        clusters.forEach((c) => {
            cs.push({
                "elems": c.getElements(),
                "transl": c.getTotalTranslation(),
                "rot": c.getTotalRotation(),
                "pos": c.getPosition(),
            });
        });
        let undo = function () {
            cs.forEach((c) => {
                rotateElementsByQuaternion(c["elems"], c["rot"].clone().conjugate(), c["pos"]);
                translateElements(c["elems"], c["transl"].clone().negate());
            });
        };
        let redo = function () {
            cs.forEach((c) => {
                translateElements(c["elems"], c["transl"]);
                rotateElementsByQuaternion(c["elems"], c["rot"], c["pos"]);
            });
        };
        super(undo, redo);
    }
    ;
}
// Adapted from https://github.com/worsnupd/ts-data-structures
class Stack {
    constructor() {
        this.size = 0;
    }
    push(data) {
        this.top = new StackElem(data, this.top);
        this.size++;
    }
    pop() {
        if (this.isEmpty()) {
            throw new Error('Empty stack');
        }
        const data = this.top.data;
        this.top = this.top.next;
        this.size--;
        return data;
    }
    peek() {
        if (this.isEmpty()) {
            throw new Error('Empty stack');
        }
        return this.top.data;
    }
    isEmpty() {
        return this.size === 0;
    }
}
class StackElem {
    constructor(data, next) {
        this.data = data;
        this.next = next;
        ;
    }
}
