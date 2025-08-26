importScripts('./io.js');
let offset = 0;
let cur_offset = 0;
let indices = [];
let count = 0;
let firstRead = 0;
onmessage = function (e) {
    const file = e.data;
    const chunker = new FileChunker(file, 1024 * 1024 * 50);
    const index = () => {
        chunker.getNextChunk().arrayBuffer().then(value => {
            let buff = new Uint8Array(value);
            let val = 116; // t
            let i = -1;
            // we know that the 1st offset is 0 as file starts with t 
            if (firstRead)
                i = 0;
            //populate the index array by the positions of t
            while ((i = buff.indexOf(val, i + 1)) != -1) {
                cur_offset = chunker.getOffset() + i;
                if (offset != cur_offset)
                    indices.push([offset, cur_offset - offset, count++]);
                offset = cur_offset;
            }
            //handle the last chunk
            if (chunker.isLast()) {
                let size = chunker.file.size - offset;
                if (size)
                    indices.push([offset, size, count++]);
            }
            if (indices.length > 0)
                //handle the index transfer
                postMessage([indices,
                    chunker.isLast(),
                    chunker.getEstimatedState(indices)], undefined);
            //loop
            if (!chunker.isLast())
                index();
        }, reason => {
            console.log(reason);
        });
    };
    //start indexing loop
    index();
};
