class EditHistory {
    constructor() {
        this.undoStack = new Stack();
        this.redoStack = new Stack();
    }
    ;
    /**
     * Performsrevertable edit and add it to the undo history stack
     * @param edit object describing the revertable edit.
     */
    do(edit) {
        edit.redo();
        this.undoStack.push(edit);
        // We no longer care about the alternate future:
        this.redoStack = new Stack();
    }
    /**
     * Add revertable edit to the undo history stack without performing it.
     * @param edit object describing the revertable edit.
     */
    add(edit) {
        this.undoStack.push(edit);
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
                "elements": c.getElements(),
                "translation": c.getTotalTranslation(),
                "rotation": c.getTotalRotation(),
                "position": c.getPosition(),
            });
        });
        let undo = function () {
            cs.forEach((c) => {
                rotateElementsByQuaternion(c["elements"], c["rotation"].clone().conjugate(), c["position"]);
                translateElements(c["elements"], c["translation"].clone().negate());
            });
        };
        let redo = function () {
            cs.forEach((c) => {
                translateElements(c["elements"], c["translation"]);
                rotateElementsByQuaternion(c["elements"], c["rotation"], c["position"]);
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
