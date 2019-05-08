angular
	.module('DeepLearning', ['ngWebworker'])
	.controller('NeuralNetworksController', ['$scope', 'Webworker', function($scope, Webworker) {
	
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
	});
