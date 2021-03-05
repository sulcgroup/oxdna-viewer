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
    if (myChart === null)
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
                    mode: "dataset",
                    intersect: true
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
let axis_counter = 1;
let handleParameterDrop = (files) => {
    labels = [];
    //console.log(files);
    for (let i = 0; i < files.length; i++) {
        const parameterFileReader = new FileReader(); //read .json
        parameterFileReader.onload = () => {
            let json_data = parameterFileReader.result;
            let parameter = JSON.parse(json_data);
            let data = [];
            trajReader.lookupReader.position_lookup.forEach((p, i) => {
                labels.push(p[2]);
                data.push(parameter[i]);
            });
            if (myChart.data.datasets.length == 0) {
                myChart.data = {
                    labels: labels,
                    datasets: [
                        {
                            label: files[0].name.split(".")[0],
                            data: data,
                            fill: false,
                            borderColor: chartColorMap.get(),
                        }
                    ]
                };
            }
            else {
                myChart.data.datasets.push({
                    label: files[i].name.split(".")[0],
                    data: data,
                    fill: false,
                    borderColor: chartColorMap.get(),
                    yAxisID: `y-axis-id${axis_counter}`
                });
                myChart.options.scales.yAxes.push({
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: `y-axis-id${axis_counter}`,
                });
                axis_counter++;
            }
            myChart.update();
        };
        parameterFileReader.readAsText(files[i]);
    }
};
