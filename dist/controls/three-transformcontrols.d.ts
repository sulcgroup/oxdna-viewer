import { Camera, Object3D } from "../lib/three-core";

export class TransformControls extends Object3D {
    constructor(object: Camera, domElement?: HTMLElement);
    
    size: number;
    
    space: string;

    object: Object3D;

    update(): void;

    hide(): void;

    isHovered(): boolean;

    getMode(): string;

    setMode(mode: string): void;

    setSnap(snap: any): void;

    setSize(size: number): void;

    setSpace(space: string): void;
    
    setTranslationSnap(size: number): void;
    
    setRotationSnap(size: number): void;

}
