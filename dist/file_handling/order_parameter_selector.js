/// <reference path="../typescript_definitions/index.d.ts" />
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
let event_plug = (event) => {
    event.preventDefault();
};
let myChart = null;
let labels = [];
let loadHyperSelector = () => {
    // register 1st drop event 
    let msg = document.getElementById("parameterDropId");
    msg.addEventListener("drop", (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        handleParameterDrop(files);
        document.getElementById("chartContainer").hidden = false;
        msg.hidden = true;
    }, false);
    msg.addEventListener("dragover", event_plug, false);
    msg.addEventListener("dragenter", event_plug, false);
    msg.addEventListener("dragexit", event_plug, false);
    // register drop event 
    let target = document.getElementById("myChart");
    target.addEventListener("drop", (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        handleParameterDrop(files);
    }, false);
    target.addEventListener("dragover", event_plug, false);
    target.addEventListener("dragenter", event_plug, false);
    target.addEventListener("dragexit", event_plug, false);
    var ctx = document.getElementById('myChart').getContext('2d');
    document.getElementById('myChart').onclick = function (evt) {
        var activePoints = myChart.getElementsAtEvent(evt);
        // => activePoints is an array of points on the canvas that are at the same position as the click event.
        // we should have only 1
        if (activePoints[0]) {
            let index = activePoints[0]["_index"];
            trajReader.retrieveByIdx(index);
        }
    };
    if (myChart === null || myChart.ctx !== ctx)
        axis_counter = 0;
    myChart = new Chart(ctx, {
        type: 'line',
        options: {
            elements: {
                line: {
                    tension: 0 // disables bezier curves
                }
            },
            animation: {
                duration: 0 // general animation time
            },
            hover: {
                animationDuration: 0,
            },
            responsiveAnimationDuration: 0,
            scales: {
                xAxes: [{ display: true, scaleLabel: { display: true, labelString: 'Time' }, gridLines: { drawOnChartArea: false } }],
                yAxes: [{ display: true, gridLines: { drawOnChartArea: false } }],
            },
            annotation: {
                events: ["click"],
                annotations: [
                    {
                        drawTime: "afterDatasetsDraw",
                        id: "hline",
                        type: "line",
                        mode: "vertical",
                        scaleID: "x-axis-0",
                        value: 0,
                        borderColor: "black",
                        borderWidth: 1
                    }
                ]
            }
        }
    });
};
class ChartColorMap {
    constructor() {
        this.colors = [
            'rgba(253,210,145,200)',
            'rgba(255,179,34,200)',
            'rgba(67,112,146 ,200)',
            'rgba(110,164,204,200)',
        ];
        this.i = 0;
    }
    get() {
        this.i++;
        if (this.i >= this.colors.length)
            this.i = 0;
        return this.colors[this.i];
    }
}
let chartColorMap = new ChartColorMap();
let axis_counter = 0;
let handleParameterDrop = (files) => {
    function replaceAll(string, search, replace) {
        return string.split(search).join(replace);
    }
    labels = [];
    trajReader.lookupReader.position_lookup.forEach((p, i) => {
        labels.push(p[2]);
    });
    // populate the labels
    //console.log(files);
    for (let i = 0; i < files.length; i++) {
        const parameterFileReader = new FileReader(); //read .json
        parameterFileReader.onload = () => {
            let file_data = parameterFileReader.result;
            let parameters = {}; // we want a dictionary in the end 
            if (file_data.startsWith("{")) { // case 1 we are json
                file_data = replaceAll(file_data, "NaN", "null");
                parameters = JSON.parse(file_data);
            }
            else {
                // we are probably text lets handle it in the oxdna.org 
                // distance file spec 
                let lines = file_data.split("\n");
                let header = (lines.shift()).trim().split("\t");
                // register column names  
                for (let i = 0; i < header.length; i++)
                    parameters[header[i]] = [];
                //now iterate over the lines populating the parameters 
                for (let i = 0; i < lines.length; i++) {
                    let vals = lines[i].split("\t");
                    for (let j = 0; j < header.length; j++)
                        parameters[header[j]].push(vals[j]);
                }
            }
            // add new axis for the datasets  
            if (axis_counter == 0) {
                // make sure you have at least 1 registered axis 
                myChart.options.scales.yAxes[0].id = `y-axis-id${axis_counter}`;
            }
            else {
                console.log("adding new axis");
                myChart.options.scales.yAxes.push({
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: `y-axis-id${axis_counter}`,
                });
            }
            for (let parameter_name in parameters) {
                let data = [];
                trajReader.lookupReader.position_lookup.forEach((p, i) => {
                    data.push(parameters[parameter_name][i]);
                });
                if (myChart.data.datasets.length == 0) {
                    myChart.data = {
                        labels: labels,
                        datasets: [
                            {
                                label: parameter_name,
                                data: data,
                                fill: false,
                                borderColor: chartColorMap.get(),
                                yAxisID: `y-axis-id${axis_counter}`
                            }
                        ]
                    };
                }
                else {
                    myChart.data.datasets.push({
                        label: parameter_name,
                        data: data,
                        fill: false,
                        borderColor: chartColorMap.get(),
                        yAxisID: `y-axis-id${axis_counter}`
                    });
                }
                myChart.update();
            }
            // a new axis for each new file please 
            axis_counter++;
        };
        parameterFileReader.readAsText(files[i]);
    }
};
