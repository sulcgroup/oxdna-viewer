import { Camera, EventDispatcher, Vector3 } from "./three-core";

export class Lut {
	constructor(colormap, numberofcolors: number);
	lut: THREE.Lut[];
	map;
	n: number;
	mapname: string;

	set(value: Lut): Lut;
	setMin(min: number): Lut;
	setMax(max: number): Lut;
	changeNumberOfColors(numberofcolors: number): Lut;
	changeColorMap(colormap: string) : Lut;
	copy(lut : Lut) : Lut;
	getColor(alpha : number) : Lut;
	addColorMap(colormapName, arrayOfColors) : Lut;
	
}