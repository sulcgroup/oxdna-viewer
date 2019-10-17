import { Camera, EventDispatcher, Vector3 } from "./three-core";

export class Lut {
	constructor(colormap, numberofcolors: number);
	lut: THREE.Lut[];
	map;
	n: number;
	mapname: string;

	set(value: THREE.Lut): THREE.Lut;
	setMin(min: number): THREE.Lut;
	setMax(max: number): THREE.Lut;
	changeNumberOfColors(numberofcolors: number): THREE.Lut;
	changeColorMap(colormap: string) : THREE.Lut;
	copy(lut : THREE.Lut) : THREE.Lut;
	getColor(alpha : number) : THREE.Color;
	addColorMap(colormapName, arrayOfColors) : void;
	setLegendOn(parameters) : THREE.Mesh;
	setLegendOff() : null;
	setLegendLayout(layout) : THREE.Mesh;
	setLegendPosition(position: THREE.Vector3) : {};
	setLegendLabels(parameters, callback?) : {};

}

export const ColorMapKeywords