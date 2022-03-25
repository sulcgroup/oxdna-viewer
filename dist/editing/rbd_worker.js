let run_simulation = false;
let i = 0;
let positions;
//this.onmessage = function(e) {
//    let data = e.data;
//    positions=e.data;
//    if(data){
//        run_simulation = !run_simulation;
//        if(run_simulation){
//            simulate();
//        }
//    }
//}
this.onmessage = function (e) {
    let data = e.data;
    console.log(data);
};
let simulate = () => {
    if (run_simulation) {
        //console.log(positions[0]);
        //console.log(strands[0].end3.getPos());
        //console.log(i++);
        setTimeout(simulate, 0);
    }
};
