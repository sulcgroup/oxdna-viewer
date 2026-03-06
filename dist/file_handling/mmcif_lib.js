// mmCIF file parser for oxView
// Produces a pdbinfowrapper compatible with addPDBToScene()
// Used by mmcif_worker.ts
// Tokenize one text line, handling single- and double-quoted strings.
function tokenizeLine(line) {
    const tokens = [];
    let i = 0;
    const len = line.length;
    while (i < len) {
        if (line[i] === ' ' || line[i] === '\t') {
            i++;
            continue;
        }
        if (line[i] === '#')
            break; // comment to end of line
        if (line[i] === "'") {
            i++;
            const start = i;
            while (i < len && line[i] !== "'")
                i++;
            tokens.push(line.substring(start, i));
            i++; // skip closing quote
            continue;
        }
        if (line[i] === '"') {
            i++;
            const start = i;
            while (i < len && line[i] !== '"')
                i++;
            tokens.push(line.substring(start, i));
            i++; // skip closing quote
            continue;
        }
        // bare token
        const start = i;
        while (i < len && line[i] !== ' ' && line[i] !== '\t')
            i++;
        tokens.push(line.substring(start, i));
    }
    return tokens;
}
function parseMMCIF(text) {
    const lines = text.split('\n');
    // Get entry ID from data_ block header line (e.g. "data_1BNA")
    let entryId = "cif";
    for (let li = 0; li < Math.min(lines.length, 20); li++) {
        const t = lines[li].trim();
        if (t.startsWith('data_')) {
            entryId = t.substring(5).trim() || "cif";
            break;
        }
    }
    // Tokenize the entire file into a flat token array.
    // Handles semicolon-delimited multi-line values (rare in _atom_site but valid mmCIF).
    const allTokens = [];
    let li = 0;
    while (li < lines.length) {
        const raw = lines[li];
        // Semicolon-delimited multiline value: line starts with ; at column 0
        if (raw.length > 0 && raw[0] === ';') {
            li++;
            let mlval = '';
            while (li < lines.length && (lines[li].length === 0 || lines[li][0] !== ';')) {
                mlval += lines[li] + '\n';
                li++;
            }
            allTokens.push(mlval.trimEnd());
            li++; // skip closing ;
            continue;
        }
        const trimmed = raw.trim();
        if (trimmed === '' || trimmed[0] === '#') {
            li++;
            continue;
        }
        const tok = tokenizeLine(trimmed);
        for (const t of tok)
            allTokens.push(t);
        li++;
    }
    // Find _atom_site loop_ and parse its rows.
    const colIndex = {};
    let colCount = 0;
    const atomRows = [];
    let ti = 0;
    while (ti < allTokens.length) {
        const tok = allTokens[ti];
        if (tok === 'loop_') {
            ti++;
            const loopCols = [];
            // Collect column header tokens (tokens starting with _)
            while (ti < allTokens.length && allTokens[ti].length > 0 && allTokens[ti][0] === '_') {
                loopCols.push(allTokens[ti].toLowerCase());
                ti++;
            }
            // Is this the _atom_site loop?
            if (loopCols.length > 0 && loopCols[0].startsWith('_atom_site.')) {
                loopCols.forEach((name, idx) => {
                    colIndex[name.substring('_atom_site.'.length)] = idx;
                });
                colCount = loopCols.length;
                // Parse data rows until we see a new loop_, data_ block, or standalone key
                while (ti < allTokens.length) {
                    const t0 = allTokens[ti];
                    // Stop at block/loop/key boundaries
                    if (t0 === 'loop_' || t0.startsWith('data_'))
                        break;
                    if (t0.length > 0 && t0[0] === '_')
                        break;
                    // Ensure we have enough tokens for a full row
                    if (ti + colCount > allTokens.length)
                        break;
                    // Peek: check none of the next colCount tokens are keywords
                    let rowOk = true;
                    for (let k = 0; k < colCount; k++) {
                        const tk = allTokens[ti + k];
                        if (tk === 'loop_' || tk.startsWith('data_')) {
                            rowOk = false;
                            break;
                        }
                        if (tk.length > 0 && tk[0] === '_') {
                            rowOk = false;
                            break;
                        }
                    }
                    if (!rowOk)
                        break;
                    atomRows.push(allTokens.slice(ti, ti + colCount));
                    ti += colCount;
                }
                break; // done with _atom_site
            }
            // Not _atom_site: skip its data rows
            while (ti < allTokens.length) {
                const t0 = allTokens[ti];
                if (t0 === 'loop_' || t0.startsWith('data_') || (t0.length > 0 && t0[0] === '_'))
                    break;
                ti++;
            }
        }
        else {
            ti++;
        }
    }
    if (atomRows.length === 0) {
        console.log("No _atom_site data found in mmCIF file");
        return null;
    }
    // Resolve column indices (all field names are lowercased)
    const gi = colIndex['group_pdb'];
    const modelI = colIndex['pdbx_pdb_model_num'];
    const altLocI = colIndex['label_alt_id'];
    const idI = colIndex['id'];
    const atomNameI = colIndex['label_atom_id'];
    const compIdI = colIndex['label_comp_id'];
    const chainIdI = colIndex['auth_asym_id'];
    const seqIdI = colIndex['auth_seq_id'];
    const insCodeI = colIndex['pdbx_pdb_ins_code'];
    const xI = colIndex['cartn_x'];
    const yI = colIndex['cartn_y'];
    const zI = colIndex['cartn_z'];
    const occI = colIndex['occupancy'];
    const bI = colIndex['b_iso_or_equiv'];
    const elemI = colIndex['type_symbol'];
    // Build pdbatom array, filtering to ATOM records in model 1
    const atomArray = [];
    for (const row of atomRows) {
        // Keep only ATOM records (not HETATM)
        if (gi !== undefined && row[gi] !== 'ATOM')
            continue;
        // Keep only model 1
        if (modelI !== undefined && row[modelI] !== '1')
            continue;
        // Keep only primary alt loc (. = inapplicable = only conformer, or "A")
        if (altLocI !== undefined) {
            const alt = row[altLocI];
            if (alt !== '.' && alt !== '?' && alt !== 'A')
                continue;
        }
        const atom = new pdbatom();
        atom.indx = idI !== undefined ? row[idI] : '';
        atom.atomType = atomNameI !== undefined ? row[atomNameI] : '';
        atom.altLoc = altLocI !== undefined ? row[altLocI] : '';
        if (atom.altLoc === '.' || atom.altLoc === '?')
            atom.altLoc = '';
        atom.resType = compIdI !== undefined ? row[compIdI] : '';
        atom.chainID = chainIdI !== undefined ? row[chainIdI] : 'A';
        if (atom.chainID === '.' || atom.chainID === '?')
            atom.chainID = 'A';
        atom.pdbResIdent = seqIdI !== undefined ? row[seqIdI] : '';
        if (atom.pdbResIdent === '.' || atom.pdbResIdent === '?')
            atom.pdbResIdent = '0';
        const ins = insCodeI !== undefined ? row[insCodeI] : '.';
        atom.iCode = (ins === '.' || ins === '?') ? '' : ins;
        atom.x = xI !== undefined ? parseFloat(row[xI]) / 8.518 : 0;
        atom.y = yI !== undefined ? parseFloat(row[yI]) / 8.518 : 0;
        atom.z = zI !== undefined ? parseFloat(row[zI]) / 8.518 : 0;
        atom.occupancy = occI !== undefined ? row[occI] : '';
        atom.tempFactor = bI !== undefined ? row[bI] : '';
        atom.element = elemI !== undefined ? row[elemI] : '';
        atomArray.push(atom);
    }
    if (atomArray.length === 0) {
        console.log("No ATOM records found in mmCIF file");
        return null;
    }
    // Group atoms into residues and chains, preserving insertion order.
    const chainOrder = [];
    const chainAtomIndx = {};
    const chainResKeys = {};
    const chainResMap = {};
    let chainIndxCounter = 0;
    for (const atom of atomArray) {
        const cid = atom.chainID;
        // Residue key: sequence id + insertion code (matches PDB reader convention)
        const rk = atom.pdbResIdent + atom.iCode;
        if (!(cid in chainAtomIndx)) {
            chainOrder.push(cid);
            chainIndxCounter++;
            chainAtomIndx[cid] = chainIndxCounter;
            chainResKeys[cid] = [];
            chainResMap[cid] = {};
        }
        atom.chainIndx = chainAtomIndx[cid];
        if (!(rk in chainResMap[cid])) {
            const res = new pdbresidue();
            res.resType = atom.resType;
            res.pdbResIdent = atom.pdbResIdent;
            res.chainID = cid;
            res.chainIndx = chainAtomIndx[cid];
            chainResMap[cid][rk] = res;
            chainResKeys[cid].push(rk);
        }
        chainResMap[cid][rk].atoms.push(atom);
    }
    // Build chain array
    const chains = [];
    for (const cid of chainOrder) {
        const chain = new pdbchain();
        chain.chainID = cid;
        chain.chainIndx = chainAtomIndx[cid];
        chain.residues = chainResKeys[cid].map(rk => chainResMap[cid][rk]);
        chains.push(chain);
    }
    if (chains.length === 0) {
        console.log("No chains found in mmCIF file");
        return null;
    }
    // Build initlist — all chains are unique in mmCIF (no biological assembly repeat chains).
    // uniqueStart/uniqueEnd are line-number offsets used only by the PDB line-scanner;
    // addPDBToScene reads directly from pdbsysinfo, so these fields are unused dummy values.
    const initlist = new pdbReadingList();
    initlist.uniqueIDs = chainOrder.slice();
    initlist.uniqueStart = chainOrder.map(() => 0);
    initlist.uniqueEnd = chainOrder.map(() => 0);
    // repeatIDs and friends remain []
    return new pdbinfowrapper(entryId, chains, initlist);
}
