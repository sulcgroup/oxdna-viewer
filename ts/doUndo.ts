
class EditHistory {
    private undoStack: Stack<RevertableEdit>;
    private redoStack: Stack<RevertableEdit>;

    constructor() {
        this.undoStack = new Stack<RevertableEdit>();
        this.redoStack = new Stack<RevertableEdit>();
    };

    /**
     * Performsrevertable edit and add it to the undo history stack
     * @param edit object describing the revertable edit.
     */
    public do(edit: RevertableEdit) {
        edit.redo();
        this.undoStack.push(edit);

        // We no longer care about the alternate future:
        this.redoStack = new Stack<RevertableEdit>();
    }

    /**
     * Add revertable edit to the undo history stack without performing it.
     * @param edit object describing the revertable edit.
     */
    public add(edit: RevertableEdit) {
        this.undoStack.push(edit);
    }

    public undo() {
        let edit: RevertableEdit;
        try {
            edit = this.undoStack.pop();
        } catch(e) {
            return // Cannot undo any further
        }
        edit.undo();
        this.redoStack.push(edit);
    }

    public redo() {
        let edit: RevertableEdit;
        try {
            edit = this.redoStack.pop();
        } catch(e) {
            return // Cannot undo any further
        }
        edit.redo();
        this.undoStack.push(edit);
    }
}

class RevertableEdit {
    undo: () => void;
    redo: () => void;

    /**
     * Takes undo and redo functions as arguments.
     * @param undo function that, when applied, will revert the edit
     * @param redo function that, when applied, will perform the edit
     */
    constructor(undo: () => void, redo: () => void) {
        this.undo = undo;
        this.redo = redo;
    };
}

class RevertableTranslation extends RevertableEdit {
    constructor(translatedElements: Set<BasicElement>,translationVector: THREE.Vector3) {
        const elements = new Set(translatedElements);
        const v = translationVector.clone();
        let undo = function() {
            translateElements(elements, v.clone().negate());
        };

        let redo = function() {
            translateElements(elements, v);
        }

        super(undo, redo);
    };
}

class RevertableRotation extends RevertableEdit {
    constructor(rotatedElements: Set<BasicElement>, axis: THREE.Vector3, angle: number, about: THREE.Vector3) {
        const elements = new Set(rotatedElements);
        const c = about.clone();
        let undo = function() {
            rotateElements(elements, axis, -1*angle, c);
        };

        let redo = function() {
            rotateElements(elements, axis, angle, c);
        }

        super(undo, redo);
    };
}

class RevertableClusterSim extends RevertableEdit {
    constructor(clusters: Cluster[]) {
        let cs = [];
        clusters.forEach((c) => {
            cs.push({
                "elements": c.getElements(),
                "translation": c.getTotalTranslation(),
                "rotation": c.getTotalRotation(),
                "position": c.getPosition(),
            });
        });

        let undo = function() {
            cs.forEach((c) => {
                rotateElementsByQuaternion(
                    c["elements"],
                    c["rotation"].clone().conjugate(),
                    c["position"]
                );
                translateElements(
                    c["elements"],
                    c["translation"].clone().negate()
                );
            });
        };
        let redo = function() {
            cs.forEach((c) => {
                translateElements(c["elements"], c["translation"]);
                rotateElementsByQuaternion(c["elements"], c["rotation"], c["position"]);
            });
        }
        super(undo, redo);
    };
}

// Adapted from https://github.com/worsnupd/ts-data-structures
class Stack<T> {
    private top: StackElem<T>;
    public size: number = 0;

    public push(data: T): void {
        this.top = new StackElem(data, this.top);
        this.size++;
    }

    public pop(): T {
        if (this.isEmpty()) {
            throw new Error('Empty stack');
        }
        const data = this.top.data;
        this.top = this.top.next;
        this.size--;

        return data;
    }

    public peek(): T {
        if (this.isEmpty()) {
            throw new Error('Empty stack');
        }
        return this.top.data;
    }

    public isEmpty(): boolean {
        return this.size === 0;
    }
}

class StackElem<T> {
    constructor(
        public data: T,
        public next: StackElem<T>,
    ) {;}
}