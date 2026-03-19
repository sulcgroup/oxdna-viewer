/**
 * Generates extended dot-bracket-plus notation from loaded designs
 * and integrates with the dbp_view iframe for secondary structure visualization.
 */

/**
 * Build a pair map from mutual trap forces.
 * Only considers pairs where both A→B and B→A traps exist (truly mutual).
 * Returns a Map<BasicElement, BasicElement> of paired elements.
 */
function buildMutualTrapPairMap(): Map<BasicElement, BasicElement> {
    const pairMap = new Map<BasicElement, BasicElement>();
    const traps = forceHandler.getTraps().filter(f => f instanceof MutualTrap) as MutualTrap[];

    // Build a set of directed edges
    const directed = new Map<string, MutualTrap>();
    traps.forEach(t => {
        const key = `${t.particle.id}->${t.ref_particle.id}`;
        directed.set(key, t);
    });

    // Find mutual pairs (A→B and B→A both exist)
    traps.forEach(t => {
        const reverseKey = `${t.ref_particle.id}->${t.particle.id}`;
        if (directed.has(reverseKey) && !pairMap.has(t.particle)) {
            pairMap.set(t.particle, t.ref_particle);
            pairMap.set(t.ref_particle, t.particle);
        }
    });

    return pairMap;
}

/**
 * Generate extended dot-bracket-plus notation for the loaded design.
 * Format: sequence lines and structure lines separated by strands with '+'.
 * 
 * @param useMutualTraps If true, treat mutual trap forces as base pairs
 * @returns Object with {sequence, structure} strings
 */
function generateExtendedDotBracketPlus(useMutualTraps: boolean = false): {sequence: string, structure: string} {
    if (systems.length === 0) {
        notify("No system loaded", "alert");
        return null;
    }

    const sys = systems[systems.length - 1];
    const naStrands = sys.strands.filter(s => s.isNucleicAcid()) as NucleicAcidStrand[];

    if (naStrands.length === 0) {
        notify("No nucleic acid strands found", "alert");
        return null;
    }

    // Ensure basepairs are computed
    if (!sys.checkedForBasepairs) {
        findBasepairs();
    }

    // Build trap pair map if requested
    let trapPairMap: Map<BasicElement, BasicElement> = null;
    if (useMutualTraps) {
        trapPairMap = buildMutualTrapPairMap();
    }

    // Collect all monomers in strand order, building flat arrays
    const allMonomers: Nucleotide[] = [];
    const strandLengths: number[] = [];

    naStrands.forEach(strand => {
        const monomers = strand.getMonomers() as Nucleotide[];
        strandLengths.push(monomers.length);
        allMonomers.push(...monomers);
    });

    // Build element-to-index map
    const elemToIdx = new Map<BasicElement, number>();
    allMonomers.forEach((m, i) => {
        elemToIdx.set(m, i);
    });

    // Build pair index array: pairIdx[i] = j means position i is paired with position j
    const n = allMonomers.length;
    const pairIdx: number[] = new Array(n).fill(-1);

    allMonomers.forEach((m, i) => {
        if (pairIdx[i] !== -1) return; // Already paired

        let partner: BasicElement = null;

        // Check native basepair
        if (m.pair && elemToIdx.has(m.pair)) {
            partner = m.pair;
        }

        // Check mutual trap pairs (override or supplement)
        if (!partner && useMutualTraps && trapPairMap && trapPairMap.has(m)) {
            const trapPartner = trapPairMap.get(m);
            if (elemToIdx.has(trapPartner)) {
                partner = trapPartner;
            }
        }

        if (partner) {
            const j = elemToIdx.get(partner);
            if (j !== undefined && j !== i) {
                pairIdx[i] = j;
                pairIdx[j] = i;
            }
        }
    });

    // Build sequence string with '+' separators
    const seqParts: string[] = [];
    let offset = 0;
    strandLengths.forEach(len => {
        const strandSeq = allMonomers.slice(offset, offset + len).map(m => m.type || 'N').join('');
        seqParts.push(strandSeq);
        offset += len;
    });
    const sequence = seqParts.join('+');

    // Build dot-bracket string with pseudoknot support via multiple bracket types
    const bracketPairs = [['(', ')'], ['[', ']'], ['{', '}']];
    const dbArray: string[] = new Array(n).fill('.');

    // Collect all pairs where i < j
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) {
        const j = pairIdx[i];
        if (j > i) {
            pairs.push([i, j]);
        }
    }

    // Sort pairs by opening position
    pairs.sort((a, b) => a[0] - b[0]);

    // Assign bracket levels: pairs that cross get different levels
    const pairLevels: number[] = new Array(pairs.length).fill(-1);

    for (let pi = 0; pi < pairs.length; pi++) {
        const [a, b] = pairs[pi];
        const usedLevels = new Set<number>();

        for (let pj = 0; pj < pi; pj++) {
            const [c, d] = pairs[pj];
            // Check if pairs cross (pseudoknot): c < a < d < b or a < c < b < d
            if ((c < a && a < d && d < b) || (a < c && c < b && b < d)) {
                if (pairLevels[pj] !== -1) {
                    usedLevels.add(pairLevels[pj]);
                }
            }
        }

        // Assign lowest available level
        let level = 0;
        while (usedLevels.has(level)) level++;
        pairLevels[pi] = Math.min(level, bracketPairs.length - 1);
    }

    // Write brackets
    for (let pi = 0; pi < pairs.length; pi++) {
        const [i, j] = pairs[pi];
        const level = pairLevels[pi];
        const [open, close] = bracketPairs[level];
        dbArray[i] = open;
        dbArray[j] = close;
    }

    // Insert '+' at strand boundaries
    const structParts: string[] = [];
    offset = 0;
    strandLengths.forEach(len => {
        structParts.push(dbArray.slice(offset, offset + len).join(''));
        offset += len;
    });
    const structure = structParts.join('+');

    return {sequence, structure};
}

/**
 * Generate the dot-bracket-plus text and populate the textarea in the dbpView window.
 */
function generateDBPText() {
    const useMutualTraps = (document.getElementById('dbpUseMutualTraps') as HTMLInputElement)?.checked || false;
    const result = generateExtendedDotBracketPlus(useMutualTraps);

    if (!result) return;

    const textarea = document.getElementById('dbpOutput') as HTMLTextAreaElement;
    if (textarea) {
        textarea.value = `${result.sequence}\n${result.structure}`;
    }
}

/**
 * Download the generated dot-bracket-plus as a .dbp file.
 */
function downloadDBPFile() {
    const textarea = document.getElementById('dbpOutput') as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim()) {
        notify("Generate the dot-bracket first", "alert");
        return;
    }

    const blob = new Blob([textarea.value], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'structure.dbp';
    a.click();
    URL.revokeObjectURL(a.href);
}

/**
 * Send the generated dot-bracket-plus to the dbp_view iframe.
 * Since the iframe is cross-origin, we post a message with the data.
 * The dbp_view tool would need to support this; as a fallback we
 * download the file for the user to drag-drop into the iframe.
 */
function sendToDBPViewIframe() {
    const textarea = document.getElementById('dbpOutput') as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim()) {
        notify("Generate the dot-bracket first", "alert");
        return;
    }

    const iframe = document.getElementById('dbpViewIframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
        // Try postMessage - the iframe app may or may not handle this
        iframe.contentWindow.postMessage({
            type: 'load_structure',
            data: textarea.value
        }, '*');
        notify("Data sent to viewer. If it doesn't load, download and drag the file into the viewer.", "info");
    } else {
        downloadDBPFile();
    }
}
