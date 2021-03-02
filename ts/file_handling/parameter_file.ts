/// <reference path="../typescript_definitions/index.d.ts" />


let loadChart = ()=>{
    var ctx = (<HTMLCanvasElement>document.getElementById('myChart')).getContext('2d');
    document.getElementById('myChart').onclick = function(evt){   
        var activePoints :Array<{}> = myChart.getElementsAtEvent(evt);
        // => activePoints is an array of points on the canvas that are at the same position as the click event.
        // we should have only 1
        if(activePoints[0])
            trajReader.retrieveByIdx(activePoints[0]["_index"])
    };
    let data = [];
    let labels = [];
    let minVal = trajReader.lookupReader.position_lookup[0][3];
    let maxVal = trajReader.lookupReader.position_lookup[0][3];
    trajReader.lookupReader.position_lookup.forEach(p =>{
        labels.push(p[2]);
        data.push(p[3]);
        if(p[3]> maxVal)
            maxVal = p[3];
        if(p[3]< minVal)
            minVal = p[2];
    });

    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels : labels, 
            datasets:[
                {
                    label: "E",
                    data:data,
                    backgroundColor:'rgba(0,0,0,0)',
                    borderColor:'rgba(0,0,255,150)',
                }
            ]
            
        },
        options: {
            scales: {
                yAxes: [{
                    //suggestedMin: minVal,
                    //suggestedMax: maxVal
                }]
            },
            elements: {
                line: {
                    tension: 0 // disables bezier curves
                }
            },
            animation: {
                duration: 0 // general animation time
            },
            hover: {
                animationDuration: 0 // duration of animations when hovering an item
            },
            responsiveAnimationDuration: 0 // animation duration after a resize
        }
    });     
}