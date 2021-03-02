/// <reference path="../typescript_definitions/index.d.ts" />
let event_plug = (event) => {
    event.preventDefault();
};
let myChart = null;
let labels = [];
let loadHyperSelector = () => {
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
        if (activePoints[0])
            trajReader.retrieveByIdx(activePoints[0]["_index"]);
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
                    animationDuration: 0 // duration of animations when hovering an item
                },
                responsiveAnimationDuration: 0 // animation duration after a resize
            }
        });
};
let handleParameterDrop = (files) => {
    labels = [];
    console.log(files);
    const parameterFileReader = new FileReader(); //read .json
    parameterFileReader.onload = () => {
        let json_data = parameterFileReader.result;
        let parameter = JSON.parse(json_data);
        let data = [];
        trajReader.lookupReader.position_lookup.forEach((p, i) => {
            labels.push(p[2]);
            console.log(p[2], i, parameter[i]);
            data.push(parameter[i]);
        });
        myChart.data = {
            labels: labels,
            datasets: [
                {
                    label: files[0].name,
                    data: data,
                    backgroundColor: 'rgba(0,0,0,0)',
                    borderColor: 'rgba(0,0,255,150)',
                }
            ]
        };
        myChart.update();
    };
    parameterFileReader.readAsText(files[0]);
};
//let dummy = document.getElementById("myChart");
//dummy.addEventListener("drop",      event_plug, false);
//dummy.addEventListener("dragover",  event_plug, false);
//dummy.addEventListener("dragenter", event_plug, false);
//dummy.addEventListener("dragexit",  event_plug, false);
//
//let dummy2 = document.getElementById("chartContainer");
//dummy2.addEventListener("drop",      event_plug, false);
//dummy2.addEventListener("dragover",  event_plug, false);
//dummy2.addEventListener("dragenter", event_plug, false);
//dummy2.addEventListener("dragexit",  event_plug, false);
//
//let dummy3 =  document.getElementById("hyperSelectWindow");
//dummy3.addEventListener("drop",      event_plug, false);
//dummy3.addEventListener("dragover",  event_plug, false);
//dummy3.addEventListener("dragenter", event_plug, false);
//dummy3.addEventListener("dragexit",  event_plug, false);
//
//
