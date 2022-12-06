// ideally we have to push the positions back and forth ...
// but if we do so we get a race condition so instead we'll update the positions / rotations
// and send them back for now...
const update = (wsystems) => {
    //grab yourself a system
    const s = wsystems[1];
    console.log(s);
    console.log(s.bbconOffsets[0]);
    for (let i = 0; i < 50; i++)
        s.bbconOffsets[i] += 10;
    console.log(s.bbconOffsets[0]);
    console.log("close to posting back");
    return wsystems;
};
let wsystems;
onmessage = (msg) => {
    console.log("got msg");
    let msg_object = msg.data;
    if (msg_object.msg === "transfer") {
        console.log("doing workkk");
        wsystems = msg_object.collection;
        postMessage(update(wsystems), undefined);
    }
    //console.log();
    //postMessage(update(systems), undefined);
};
