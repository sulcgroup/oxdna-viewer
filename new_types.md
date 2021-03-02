'''
    npm install --save @types/chart.js
'''


class ChartColorMap{
    colors = [
        'rgba253,   	210,	145,0],
        'rgba255,   	179,	34,0],
        'rgba67	,   112	,146  ,0    ],        
        'rgba110,   	164,	204,0],
    ]
    i = 0;
    constructor(){

    }
    get(){
        this.i++;
        if (this.i >= this.colors.length) this.i = 0;

        //let c = this.colors[this.i];
        //let s =  `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
        return s ;
    }
}
let chartColorMap = new ChartColorMap();