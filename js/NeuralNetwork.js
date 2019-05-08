angular.module('d3', []).factory('d3Service', [function(){ return d3; }]);
  
angular
	.module('DeepLearning', ['ngWebworker', 'ngFileSaver', 'd3'])
	.controller('NeuralNetworksController', ['$scope', 'Webworker', 'FileSaver', 'Blob', function($scope, Webworker, FileSaver, Blob) {
	
		$scope.Network = {};
		$scope.NetworkOptions = {};
		$scope.HiddenLayerNodes = [];
		$scope.Classification = [];
		$scope.Prediction = [];
		
		$scope.TrainingData = [];
		$scope.Output = [];
		$scope.Inputs = 0;
		$scope.Categories = 0;
		$scope.Items = 0;
		$scope.hiddenLayerNodes = 4;
		$scope.LearningRate = 2.0;
		$scope.Epochs = 10000;
		$scope.Tolerance = 0.0001;

		$scope.TestData = [];
		$scope.Samples = 0;
		$scope.Threshold = 0.9;
		
		$scope.Training = false;
		
		$scope.SelectedFile = {};
		$scope.TestFile = {};
		$scope.NetworkFile = {};
		
		$scope.DelimiterNames = ["Tab \\t", "Comma ,", "Space \\s", "Vertical Pipe |", "Colon :", "Semi-Colon ;", "Forward Slash /", '/', "Backward Slash \\"];
		$scope.Delimiters = ['\t', ',', ' ', '|', ':', ';', '/', '\\'];
		$scope.delimiter = $scope.DelimiterNames[0];
		$scope.SelectedDelimiter = 0;
		
		$scope.SelectDelimeter = function() {
			
			var i = $scope.DelimiterNames.indexOf($scope.delimiter);
			
			$scope.SelectedDelimiter = i + 1;
		}
		
		$scope.AddHiddenLayer = function() {
			
			$scope.HiddenLayerNodes.push(parseInt($scope.hiddenLayerNodes));
		}
		
		$scope.RemoveHiddenLayer = function(layer) {
			
			if ($scope.HiddenLayerNodes.length > 0 && layer >= 0 & layer < $scope.HiddenLayerNodes.length) {
				
				$scope.HiddenLayerNodes.splice(layer, 1)
			}
		}
		
		$scope.RemoveAllHiddenLayers = function() {
			
			$scope.HiddenLayerNodes = [];
		}

		
		$scope.ReadTestData = function() {
			
			$scope.TestData = [];
			$scope.Samples = 0;
			
			var reader = new FileReader();

			reader.onload = function(progressEvent) {

				$scope.$apply(function() {
					
					var lines = reader.result.split('\n');
					
					var delim = $scope.SelectedDelimiter > 0 ? $scope.Delimiters[$scope.SelectedDelimiter - 1] : "\t";
					
					for (var line = 0; line < lines.length; line++) {

						var tmp = [];

						var tokens = lines[line].trim().split(delim);

						if (tokens.length >= $scope.Inputs) {
							
							for (var i = 0; i < tokens.length; i++) {
								
								if (i >= 0 && i < $scope.Inputs)
									tmp.push(parseFloat(tokens[i]));
							}
							
							if (tmp.length > 0) {
								
								$scope.TestData.push(tmp);
								
								$scope.Samples++;
							}
						}
					}
					
					$scope.testContent = reader.result.trim();
					
				});
			}

			if ($scope.TestFile.name != undefined) {
				
				reader.readAsText($scope.TestFile);
			}
		};
		
		$scope.ReadTrainingData = function() {
			
			$scope.TrainingData = [];
			$scope.Output = [];
			$scope.Items = 0;
			$scope.Categories = 0;
			$scope.Inputs = 0;
			
			var reader = new FileReader();

			reader.onload = function(progressEvent) {

				$scope.$apply(function() {
					
					var lines = reader.result.split('\n');
					
					var delim = $scope.SelectedDelimiter > 0 ? $scope.Delimiters[$scope.SelectedDelimiter - 1] : "\t";
					
					for (var line = 0; line < lines.length; line++) {

						var tmp = [];

						var tokens = lines[line].trim().split(delim);

						if (tokens.length > 0) {
							
							if (line == 0 && tokens.length > 1) {
								
								$scope.Inputs = tokens.length - 1;
							}
							
							if (tokens.length > 1) {
								
								var item = parseInt(tokens[tokens.length - 1]);
								
								$scope.Categories = Math.max($scope.Categories, item);
								
								$scope.Output.push([item]);
							}
								
							for (var i = 0; i < tokens.length - 1; i++) {
								
								tmp.push(parseFloat(tokens[i]));
							}
							
							if (tmp.length > 0) {
								
								$scope.TrainingData.push(tmp);
								
								$scope.Items++;
							}
						}
					}
					
					$scope.fileContent = reader.result.trim();
					
				});
			}

			if ($scope.SelectedFile.name != undefined) {
				
				reader.readAsText($scope.SelectedFile);
			}
		};

		$scope.Initialize = function() {
			
		}
		
		$scope.asyncTrainer = undefined;
		$scope.asyncClassifier = undefined;
		
		$scope.StopAsyncTrainer = function() {

			if ($scope.asyncTrainer) {
				
				try {
					
					$scope.asyncTrainer.terminate();
		
					$scope.asyncTrainer  = null;
					
					$scope.Training = false;
					
					$scope.TrainingProgress = 0.0;
					
				} catch (err) {
					
					$scope.asyncTrainer = null;
					
					$scope.Training = false;
					
					$scope.TrainingProgress = 0.0;
				}
			}
		}
		
		$scope.StopAsyncClassifier = function() {

			if ($scope.asyncClassifier) {
				
				try {
					
					$scope.asyncClassifier.terminate();
		
					$scope.asyncClassifier  = null;
					
					$scope.ClassifierProgress = 0.0;
					
				} catch (err) {
					
					$scope.asyncTrainer = null;
					
					$scope.ClassifierProgress = 0.0;
				}
			}
		}

		// https://stackoverflow.com/questions/26320525/prettify-json-data-in-textarea-input/26324037
		$scope.PrettyPrint = function(json) {
			
			return JSON.stringify(json, undefined, 4);
		}
		
		$scope.AsyncTrainer = function() {
			
			// function that will become a worker
			function async(currentPath, input, output, alpha, epochs, categories, tolerance, hiddenLayerNodes) {

				importScripts(currentPath + "js/Models.min.js");
				
				var network = new DeepNeuralNetwork();
				var normalizedData = network.Normalize(input);

				var opts = new NeuralNetworkOptions(alpha, epochs, categories, normalizedData[0].length, normalizedData.length, tolerance, hiddenLayerNodes.length, false);
				
				network.SetupHiddenLayers(normalizedData[0].length, opts.Categories, hiddenLayerNodes);
				network.Setup(output, opts);
				
				// api to send a promise notification
				while (!network.Step(normalizedData, opts)) {
					
					if (network.Iterations % 1000 == 0)
						notify({Iterations: network.Iterations, L2: network.L2, Cost: network.Cost});
				}
				
				// api to resolve the promise. Note: according to the $q spec, 
				// a promise cannot be used once it has been resolved or rejected.
				complete({network: network, opts: opts});
			}
			
			if (!$scope.Training && $scope.Items > 0 && $scope.Inputs > 0 && $scope.Categories > 0 && $scope.HiddenLayerNodes.length > 0 && $scope.TrainingData.length > 0 && $scope.Output.length > 0) {
				
				var currentPath = document.URL;
				
				$scope.Training = true;
				
				// mark this worker as one that supports async notifications
				$scope.asyncTrainer = Webworker.create(async, { async: true });

				// uses the native $q style notification: https://docs.angularjs.org/api/ng/service/$q
				$scope.asyncTrainer.run(currentPath, $scope.TrainingData, $scope.Output, $scope.LearningRate, $scope.Epochs, $scope.Categories, $scope.Tolerance, $scope.HiddenLayerNodes).then(function(result) {
					
					// promise is resolved.

					$scope.Network = result.network;
					$scope.NetworkOptions = result.opts;
					$scope.TrainingProgress = 1.0;
					$scope.Training = false;
					$scope.networkWeights = $scope.PrettyPrint($scope.Network.Weights);
					
				}, null, function(network) {
					
					// promise has a notification
					$scope.TrainingProgress = network.Iterations / $scope.Epochs;
					$scope.Network.L2 = network.L2;
					$scope.Network.Iterations = network.Iterations;
					$scope.Network.Cost = network.Cost;
					
				}).catch(function(oError) {
					
					$scope.asyncTrainer = null;
					
				});
			}
		}
		
		$scope.AsyncClassifier = function() {
			
			// function that will become a worker
			function async(currentPath, test, trainedNetwork, opts, threshold) {

				importScripts(currentPath + "js/Models.js");
				
				var network = new DeepNeuralNetwork();
				
				network.Activations = Matrix.Create(opts.HiddenLayers);
				network.X = Matrix.Create(opts.HiddenLayers + 1);
				network.Z = Matrix.Create(opts.HiddenLayers + 1);
				network.Weights = trainedNetwork.Weights;
				network.Min = trainedNetwork.Min;
				network.Max = trainedNetwork.Max;
				
				var normalizedData = network.ApplyNormalization(test);
				
				var classification = network.Classify(normalizedData, opts, threshold);
				var prediction = network.Predict(normalizedData, opts);
				
				// api to resolve the promise. Note: according to the $q spec, 
				// a promise cannot be used once it has been resolved or rejected.
				complete({classification: classification, prediction: prediction});
			}
			
			if (!$scope.Training && $scope.Samples > 0 && $scope.Inputs > 0 && $scope.TestData.length > 0 && $scope.Network != undefined && $scope.NetworkOptions != undefined) {
				
				var currentPath = document.URL;
				
				// mark this worker as one that supports async notifications
				$scope.asyncClassifier = Webworker.create(async, { async: true });

				// uses the native $q style notification: https://docs.angularjs.org/api/ng/service/$q
				$scope.asyncClassifier.run(currentPath, $scope.TestData, $scope.Network, $scope.NetworkOptions, $scope.Threshold).then(function(result) {
					
					// promise is resolved.
					$scope.classificationResult = '';
					
					if (result.classification != undefined) {
						
						$scope.Classification = result.classification;
						
						for(var i = 0; i < $scope.Classification.length; i++) {
							
							if (i > 0) {
								
								$scope.classificationResult += '\n';
							}
							
							$scope.classificationResult += $scope.Classification[i][0].toString();
						}
					}
					
					if (result.prediction != undefined) {
						
						$scope.Prediction = result.prediction;
					}
					
					$scope.ClassifierProgress = 1.0;
					
				}, null, function(progress) {
					
				}).catch(function(oError) {
					
					$scope.asyncClassifier = null;
					
				});
			}
		}
		
		$scope.SaveNetwork = function() {
			
			if ($scope.Network.Weights != undefined) {
				
				var json = { Weights: $scope.Network.Weights, Normalization: [ $scope.Network.Min, $scope.Network.Max ] };
				var jsonse = JSON.stringify(json);
				
				var blob = new Blob([jsonse], {
					
					type: "application/json"
					
				});
				
				FileSaver.saveAs(blob, "Network.json");
			}
		}
		
		$scope.LoadNetwork = function() {
			
			$scope.Network = {};
			$scope.Inputs = 0;
			$scope.Categories = 0;
			
			var reader = new FileReader();

			reader.onload = function(progressEvent) {

				$scope.$apply(function() {
					
					var json = JSON.parse(reader.result);
					
					if (json.Weights != undefined && json.Normalization != undefined) {
						
						$scope.Network = { Weights: json.Weights, Min: json.Normalization[0], Max: json.Normalization[1] };
						
						$scope.Inputs = json.Weights[0][0].length - 1;
						$scope.Categories = json.Weights[json.Weights.length - 1].length;
						
						$scope.HiddenLayerNodes = [];
						
						for (var i = 0; i < json.Weights.length - 1; i ++) {
							
							$scope.HiddenLayerNodes.push(json.Weights[i].length);
						}
						
						$scope.NetworkOptions = { HiddenLayers: $scope.HiddenLayerNodes.length, Categories: $scope.Categories };
						$scope.networkWeights = $scope.PrettyPrint(json.Weights);
					}
				});
			}

			if ($scope.NetworkFile.name != undefined) {
				
				reader.readAsText($scope.NetworkFile);
			}
		}
		
		$scope.RenderNetwork = function() {
		
			if ($scope.Network.Weights != undefined) {
				
				var graph = { "nodes": [] };
				
				// build network
				
				// start with inputs
				for (var i = 0; i < $scope.Inputs; i++) {
					
					graph.nodes.push({"label": "i[" + (i + 1).toString() + "]", "layer": 1});
				}
				
				for (var i = 0; i < $scope.Network.Weights.length - 1; i++) {
					
					for (var x = 0; x <  $scope.Network.Weights[i].length ; x++) {
							
						graph.nodes.push({"label": "h[" + (i + 1).toString() + "][" + (x + 1).toString() + "]", "layer": i + 2});
					}
				}
				
				for (var i = 0; i < $scope.Categories; i++) {
					
					graph.nodes.push({"label": "o[" + (i + 1).toString() + "]", "layer": $scope.Network.Weights.length + 1});
				}
				
				// render graph using d3.js - modified from: https://bl.ocks.org/e9t/6073cd95c2a515a9f0ba
				var width = 960, height = 500, nodeSize = 30;
				var color = d3.scaleOrdinal(d3.schemeCategory10);

				var svg = d3.select("#viz")
					.attr("width", width)
					.attr("height", height);

				svg.selectAll("*").remove();
				
				var nodes = graph.nodes;
				
				// get network size
				var netsize = {};
					
				nodes.forEach(function (d) {
					
					if(d.layer in netsize) {
						
						netsize[d.layer] += 1;
						
					} else {
					  
					  netsize[d.layer] = 1;
					  
					}
					
					d["lidx"] = netsize[d.layer];
				});
				
				// calc distances between nodes
				var largestLayerSize = Math.max.apply(null, Object.keys(netsize).map(function (i) { return netsize[i]; }));

				var xdist = width / Object.keys(netsize).length, ydist = height / largestLayerSize;

				// create node locations
				nodes.map(function(d) {
					
					d["x"] = (d.layer - 0.5) * xdist;
					d["y"] = (d.lidx - 0.5) * ydist;
				});

				// autogenerate links
				var links = [];
				
				nodes.map(function(d, i) {
					
					for (var n in nodes) {
						
						if (d.layer + 1 == nodes[n].layer) {
							
							links.push({"source": parseInt(i), "target": parseInt(n), "value": 1}) }
					}
					
				}).filter(function(d) { return typeof d !== "undefined"; });

				// draw links
				var link = svg.selectAll(".link")
					.data(links)
					.enter().append("line")
					.attr("class", "link")
					.attr("x1", function(d) { return nodes[d.source].x; })
					.attr("y1", function(d) { return nodes[d.source].y; })
					.attr("x2", function(d) { return nodes[d.target].x; })
					.attr("y2", function(d) { return nodes[d.target].y; })
					.style("stroke-width", function(d) { return Math.sqrt(d.value); });

				// draw nodes
				var node = svg.selectAll(".node")
					.data(nodes)
					.enter().append("g")
					.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; }
				);

				var circle = node.append("circle")
					.attr("class", "node")
					.attr("r", nodeSize)
					.style("fill", function(d) { return color(d.layer); });

				node.append("text")
					.attr("text-anchor", "middle")
					.attr("dx", "-.35em")
					.attr("dy", ".35em")
					.text(function(d) { return d.label; });
			}
		}
		
		$scope.SaveRender = function() {
			
			var svg = $("#viz")[0].innerHTML;
			
			if (svg != undefined) {
			
				var style = '<svg><style type="text/css"> text { pointer-events: none; } .node:hover { stroke: #999; stroke-opacity: .6; stroke-width: 4px; } .link { stroke: #999; stroke-opacity: .6;	} </style>';
				
				svg = style + svg + "</svg>";
				
				//add name spaces.
				if(!svg.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
					
					svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
				}
			
				if(!svg.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
					
					svg = svg.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
				}

				var blob = new Blob([svg], {
					
					type: "image/svg+xml;charset=utf-8"
					
				});
				
				FileSaver.saveAs(blob, "Network.svg");
			}
		}
		
	}]).directive("filelistBind", function() {
		
		return function( scope, elm, attrs ) {
			
			elm.bind("change", function( evt ) {
				
				scope.$apply(function( scope ) {
					
					scope[ attrs.name ] = evt.target.files;
					scope['Items'] = 0;
					scope['Categories'] = 0;
					scope['Inputs'] = 0;
					scope['SelectedFile'] = evt.target.files[0];
				});
			});
		};
		
	}).directive("testfileBind", function() {
		
		return function( scope, elm, attrs ) {
			
			elm.bind("change", function( evt ) {
				
				scope.$apply(function( scope ) {
					
					scope[ attrs.name ] = evt.target.files;
					scope['Samples'] = 0;
					scope['TestFile'] = evt.target.files[0];
				});
			});
		};
	}).directive("networkfileBind", function() {
		
		return function( scope, elm, attrs ) {
			
			elm.bind("change", function( evt ) {
				
				scope.$apply(function( scope ) {
					
					scope[ attrs.name ] = evt.target.files;
					scope['NetworkFile'] = evt.target.files[0];
				});
			});
		};
	});
