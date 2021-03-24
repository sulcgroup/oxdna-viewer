'''
    npm install --save @types/chart.js
npm install --save @types/chartjs-plugin-annotation
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




		var lineChartData = {
			labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
			datasets: [{
				label: 'My First dataset',
				borderColor: window.chartColors.red,
				backgroundColor: window.chartColors.red,
				fill: false,
				data: [
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor()
				],
				yAxisID: 'y-axis-1',
			}, {
				label: 'My Second dataset',
				borderColor: window.chartColors.blue,
				backgroundColor: window.chartColors.blue,
				fill: false,
				data: [
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor(),
					randomScalingFactor()
				],
				yAxisID: 'y-axis-2'
			}]
		};

		window.onload = function() {
			var ctx = document.getElementById('canvas').getContext('2d');
			window.myLine = Chart.Line(ctx, {
				data: lineChartData,
				options: {
					responsive: true,
					hoverMode: 'index',
					stacked: false,
					title: {
						display: true,
						text: 'Chart.js Line Chart - Multi Axis'
					},
					scales: {
						yAxes: [{
							type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
							display: true,
							position: 'left',
							id: 'y-axis-1',
						}, {
							type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
							display: true,
							position: 'right',
							id: 'y-axis-2',

							// grid line settings
							gridLines: {
								drawOnChartArea: false, // only want the grid lines for one axis to show up
							},
						}],
					}
				}
			});
		};

		document.getElementById('randomizeData').addEventListener('click', function() {
			lineChartData.datasets.forEach(function(dataset) {
				dataset.data = dataset.data.map(function() {
					return randomScalingFactor();
				});
			});

			window.myLine.update();
		});
	

var presChart = new Chart(ctx, 
    {
    type: 'line',
    data:{labels: ['15:37','15:42','15:47'],
    datasets: [{fill: false, label: 'Pressure',data: [1003.11,1003.04,1003.02],
    yAxisID: "L", backgroundColor: "rgba(255,88,0,0.5)",borderColor: "rgba(255,88,0,0.5)"}]},
    options: {
        responsive: true, title:{display:true, text:'Measurements'},
        elements: {point:{pointStyle:'crossRot'}},
        scales: {
            xAxes:[{display:true, scaleLabel:{display:true, labelString:'Time'}}],
            yAxes: [{id: 'L', type: 'linear', position: 'left',scaleLabel:{display:true, labelString:'hpa'}}]
        }
    }
    });
