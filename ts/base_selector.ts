let listBases: number[] = []; //list of bases to download in .txt file
let basesInfo: string = ""; //list of bases' info - location, strand and system ids, etc. - to download in .txt file
let mouse3D;
let raycaster = new THREE.Raycaster();;
let intersects;
			

canvas.addEventListener('mousedown', event => { //if mouse is pressed down
	if (getActionModes().includes("Select")) {
		let id = gpuPicker(event)

		//if something was clicked, toggle the coloration of the appropriate things.
		if (id > -1) {
			// This runs after the selection is done and the nucleotides are toggled,
			// but it needs to be defined as a callback since the cluster selection
			// can take a while to finish.

			let nucleotide = elements.get(id);
			let sys = nucleotide.getSystem();

			// Select multiple elements my holding down ctrl
			if (!event.ctrlKey && !event.shiftKey && !selectedBases.has(nucleotide)) {
				clearSelection();
			}
			
			let strandCount = sys.strands.length;
			switch(getScopeMode()){
				case "System" :
					sys.strands.forEach(strand=>{
						strand.monomers.forEach(e=>{
                            e.toggle();
						});
					});
					updateView(sys);
					break;
				case "Strand" :
					let strandLength = nucleotide.strand.monomers.length;
					for (let i= 0; i < strandLength; i++) { //for every nucleotide in strand
						nucleotide.strand.monomers[i].toggle();
						if(selectPairs()) {
							if (!nucleotide.isPaired()) {
								longCalculation(findBasepairs, basepairMessage,
								()=>{selectPaired(nucleotide.strand.monomers[i]);updateView(sys);});
							} else {
								selectPaired(nucleotide.strand.monomers[i]);
							}
						}
					}
					updateView(sys);
					break;
				case "Monomer":
					nucleotide.toggle();
					if(event.shiftKey) {
						if(selectPairs()){
							if(!nucleotide.isPaired()) {
								longCalculation(findBasepairs, basepairMessage,
								()=>{fancySelectIntermediate(nucleotide);updateView(sys);});
							} else {
								fancySelectIntermediate(nucleotide);
							}
						} else {
							selectIntermediate();
						}
					} else if(selectPairs()) {
						if(!nucleotide.isPaired()) {
							longCalculation(findBasepairs, basepairMessage,
							()=>{selectPaired(nucleotide);updateView(sys);});
						} else {
							selectPaired(nucleotide);
						}
					}
					updateView(sys);
					break;
				case "Cluster" :
					if (typeof elements.get(0).clusterId == 'undefined') {
						document.getElementById("clusterOptions").hidden = false;
					} else {
						for (let i = 0; i < strandCount; i++){
							let strand = sys.strands[i];
							let nucCount = strand.monomers.length;
							// for every nucleotide on the Strand in the System
							for (let j = 0; j < nucCount; j++) {
								let n: BasicElement = strand.monomers[j];
								if(n.clusterId == nucleotide.clusterId) {
									n.toggle();
								}
							}
						}
						updateView(sys);
					}
					break;

			}
			if (tmpSystems.length !== 0) {
				tmpSystems.forEach((sys) => {
					sys.callUpdates(["instanceColor"])
				});
			}
		}
	}
});

function updateView(sys: System) {
	//tell the GPU to update the colors in the scene
	sys.callUpdates(["instanceColor"])
	if (tmpSystems.length !== 0) {
		tmpSystems.forEach((sys) => {
			sys.callUpdates(["instanceColor"])
		});
	}

	render(); //update scene;

	listBases = [];
	let baseInfoStrands = {};

	//sort selection info into respective containers
	selectedBases.forEach(
		(base) => {
			//store global ids for BaseList view
			listBases.push(base.gid);

			//assign each of the selected bases to a strand
			let strandID = base.strand.strandID;
			if(strandID in baseInfoStrands)
				baseInfoStrands[strandID].push(base);
			else
				baseInfoStrands[strandID] = [base];
		}
	);

	//Display every selected nucleotide id (top txt box)
	makeTextArea(listBases.join(","), "BaseList");

	//Brake down info (low txt box)
	let baseInfoLines = [];
	for (let strandID in baseInfoStrands){
		let sBases = baseInfoStrands[strandID];
		//make a fancy header for each strand
		let header = ["Str#:", strandID, "Sys#:", sBases[0].getSystem().systemID];
		baseInfoLines.push("----------------------");
		baseInfoLines.push(header.join(" "));
		baseInfoLines.push("----------------------");

		//fish out all the required base info
		//one could also sort it if neaded ...
		for(let i = 0; i < sBases.length; i++){
			baseInfoLines.push([sBases[i].type, "|", "gid:", sBases[i].gid, "|", "lID:", sBases[i].lid].join(" "));
		}
	}
	makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
};

function clearSelection() {
	elements.forEach(element => {
		if (selectedBases.has(element)) {
			element.toggle();
		}
	});
	systems.forEach(sys => {
		updateView(sys);
	});
}

function invertSelection() {
	elements.forEach(element => {
		element.toggle();
	});
	systems.forEach(sys => {
		updateView(sys);
	});
}

function selectAll() {
	elements.forEach(element => {
		if (!selectedBases.has(element)) {
			element.toggle();
		}
	});
	systems.forEach(sys => {
		updateView(sys);
	});
}

function selectPaired(e: BasicElement) {
	if (e instanceof Nucleotide) {
		let pair = (<Nucleotide>e).pair;
		if (pair) {
			pair.toggle();
		}
	}
}

function fancySelectIntermediate(e: BasicElement) {
	let paired = selectPairs();
	let d = new Dijkstra(Array.from(elements.values()), paired);
	let elems;
	longCalculation(()=>{
		elems = d.shortestPath(e, Array.from(selectedBases));
	},"Calculating intermediate elements...",
	()=>{
		elems.forEach(gid=>{
			let elem = elements.get(parseInt(gid));
			if (!selectedBases.has(elem)) {
				elem.toggle();
			}
			if (paired && elem instanceof Nucleotide){
				let pair = (<Nucleotide>elem).pair;
				if(pair && !selectedBases.has(pair)) {
					pair.toggle();
				}
			}
		});
		updateView(e.getSystem());
	});
	
}

function selectIntermediate() {
	let n = elements.getLastId();
	let iMin = 0;
	let iMax = n;
	while(iMin++ <= n) {
		if(elements.has(iMin) && selectedBases.has(elements.get(iMin))) {
			break;
		}
	}
	while(iMax-- > 0) {
		if(elements.has(iMax) && selectedBases.has(elements.get(iMax))) {
			break;
		}
	}
	for(let i=iMin; i<iMax; i++) {
		if (elements.has(i) && !selectedBases.has(elements.get(i))) {
			elements.get(i).toggle();
		}
	}
}

function makeTextArea(bases: string, id) { //insert "bases" string into text area with ID, id
	let textArea: HTMLElement | null = document.getElementById(id);
	if (textArea !== null) { //as long as text area was retrieved by its ID, id
		textArea.innerHTML =  bases; //set innerHTML / content to bases
	}
}

/**
 * Modified from SelectionBox code by HypnosNova
 * https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive
 * 
 * Used for box selection functionality in DragControls
 */
class BoxSelector {
    private frustum = new THREE.Frustum();
	private startPoint = new THREE.Vector3();
	private endPoint = new THREE.Vector3();
	private collection = [];
	private camera: THREE.PerspectiveCamera;
	private domElement: HTMLElement;
	private deep: number;
	private drawnBox: HTMLElement;
	private screenStart = new THREE.Vector2();
	private screenEnd = new THREE.Vector2();

	/**
	 * @param startPoint Start position x,y,z
	 * @param camera Camera, to calculate frustum
	 * @param deep Optional depth of frustum
	 */
    constructor(screenStart: THREE.Vector2, camera: THREE.PerspectiveCamera, domElement: HTMLElement, deep?: number) {
		this.camera = camera;
		this.domElement = domElement;
		this.deep = deep || Number.MAX_VALUE;

		this.screenStart = screenStart;

		// Setup the drawn box
		this.drawnBox = document.createElement('div');
		this.drawnBox.classList.add('selectBox');
		this.drawnBox.style.pointerEvents = 'none';
		this.drawnBox.style.left = this.screenStart.x + 'px';
		this.drawnBox.style.top = this.screenStart.y + 'px';
		this.drawnBox.style.width = '0px';
		this.drawnBox.style.height = '0px';
		renderer.domElement.parentElement.appendChild(this.drawnBox);

		// Calculate and save start point in scene coords
		this.startPoint = this.fromScreenSpace(this.screenStart);
	};
	
	/**
	 * Redraw the selection box on the screen (call whenever mouse is moved)
	 * @param screenEnd (optional) End position in x,y screen coordinates
	 * @param screenStart (optional) Start position in x,y screen coordinates
	 */
	public redrawBox(screenEnd?: THREE.Vector2, screenStart?: THREE.Vector2) {
		this.screenStart = screenStart || this.screenStart;
		this.screenEnd = screenEnd || this.screenEnd;
		
		let pointBottomRight = new THREE.Vector2(
			Math.max(this.screenStart.x, this.screenEnd.x),
			Math.max(this.screenStart.y, this.screenEnd.y)
		);
		let pointTopLeft = new THREE.Vector2(
			Math.min(this.screenStart.x, this.screenEnd.x),
			Math.min(this.screenStart.y, this.screenEnd.y)
		);
		this.drawnBox.style.left = pointTopLeft.x + 'px';
		this.drawnBox.style.top =  pointTopLeft.y + 'px';
		this.drawnBox.style.width = pointBottomRight.x - pointTopLeft.x + 'px';
		this.drawnBox.style.height = pointBottomRight.y - pointTopLeft.y + 'px';
	};

	/**
	 * @param endPoint (optional) End position x,y,z
	 * @param startPoint (optional) Start position x,y,z
	 * @return Selected elements
	 */
    public select(screenEnd?: THREE.Vector2, screenStart?: THREE.Vector2): BasicElement[] {
		this.screenStart = screenStart || this.screenStart;
		this.screenEnd = screenEnd || this.screenEnd;

		this.startPoint = this.fromScreenSpace(this.screenStart);
		this.endPoint = this.fromScreenSpace(this.screenEnd);

		// Update selected elements within box
		this.collection = [];

		this.updateFrustum(this.startPoint, this.endPoint);

		elements.forEach(element => {
			let cmPos = element.getInstanceParameter3("cmOffsets");
			if (this.frustum.containsPoint(cmPos)) {
				this.collection.push(element);
			}
		});

		return this.collection;
	};

	public onSelectOver() {
		this.drawnBox.parentElement.removeChild(this.drawnBox);
	};

	private fromScreenSpace(pos: THREE.Vector2): THREE.Vector3 {
		var rect = this.domElement.getBoundingClientRect();
		return new THREE.Vector3(
			((pos.x - rect.left) / rect.width) * 2 - 1,
			- ((pos.y - rect.top) / rect.height) * 2 + 1,
			0.5
		);
	}

	private updateFrustum(startPoint?: THREE.Vector3, endPoint?: THREE.Vector3) {
		startPoint = startPoint || this.startPoint;
		endPoint = endPoint || this.endPoint;

		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(false);

		let tmpPoint = startPoint.clone();
		tmpPoint.x = Math.min(startPoint.x, endPoint.x);
		tmpPoint.y = Math.max(startPoint.y, endPoint.y);
		endPoint.x = Math.max(startPoint.x, endPoint.x);
		endPoint.y = Math.min(startPoint.y, endPoint.y);

		let vecNear = this.camera.position.clone();
		let vecTopLeft = tmpPoint.clone();
		let vecTopRight = new THREE.Vector3(endPoint.x, tmpPoint.y, 0);
		let vecDownRight = endPoint.clone();
		let vecDownLeft = new THREE.Vector3(tmpPoint.x, endPoint.y, 0);

		vecTopLeft.unproject(this.camera); vecTopRight.unproject(this.camera);
		vecDownLeft.unproject(this.camera); vecDownRight.unproject(this.camera);

		let vectemp1 = vecTopLeft.clone().sub(vecNear);
		let vectemp2 = vecTopRight.clone().sub(vecNear);
		let vectemp3 = vecDownRight.clone().sub(vecNear);

		vectemp1.normalize(); vectemp2.normalize(); vectemp3.normalize();

		vectemp1.multiplyScalar(this.deep);
		vectemp2.multiplyScalar(this.deep);
		vectemp3.multiplyScalar(this.deep);

		vectemp1.add(vecNear); vectemp2.add(vecNear); vectemp3.add(vecNear);

		var planes = this.frustum.planes;

		planes[0].setFromCoplanarPoints(vecNear, vecTopLeft, vecTopRight);
		planes[1].setFromCoplanarPoints(vecNear, vecTopRight, vecDownRight);
		planes[2].setFromCoplanarPoints(vecDownRight, vecDownLeft, vecNear);
		planes[3].setFromCoplanarPoints(vecDownLeft, vecTopLeft, vecNear);
		planes[4].setFromCoplanarPoints(vecTopRight, vecDownRight, vecDownLeft);
		planes[5].setFromCoplanarPoints(vectemp3, vectemp2, vectemp1);
		planes[5].normal.multiplyScalar(-1);
	};
};