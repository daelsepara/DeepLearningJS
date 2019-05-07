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
		$scope.TestData = [];
		$scope.hiddenLayerNodes = 4;
		$scope.LearningRate = 2.0;
		$scope.Epochs = 10000;
		$scope.Tolerance = 0.0001;
		$scope.Threshold = 0.9;
		
		$scope.TrainingUploadProgress = 0;
		
		$scope.Training = false;
		
		$scope.SelectedFile = {};
		
		$scope.DelimiterNames = ["Tab \\t", "Comma ,", "Space \\s", "Vertical Pipe |", "Colon :", "Semi-Colon ;", "Forward Slash /", '/', "Backward Slash \\"];
		$scope.Delimiters = ['\t', ',', ' ', '|', ':', ';', '/', '\\'];
		$scope.delimiter = "";
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
		
		$scope.ReadTrainingData = function() {
			
			$scope.TrainingData = [];
			$scope.Output = [];
			$scope.Items = 0;
			$scope.Categories = 0;
			$scope.Inputs = 0;
			
			var reader = new FileReader();

			reader.onload = function(progressEvent) {

				$scope.TrainingUploadProgress = progressEvent.loaded / progressEvent.total;
				
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
		
		$scope.AsyncProgress = 0;
		
		$scope.TestAsync = function() {
			
			// function that will become a worker
			function async() {
				// api to send a promise notification
				for (var i = 0; i < 100000; i++) {
					notify(i);
				}
				
				// api to resolve the promise. Note: according to the $q spec, 
				// a promise cannot be used once it has been resolved or rejected.
				complete();
			}

			// mark this worker as one that supports async notifications
			var myWorker = Webworker.create(async, {async: true });

			// uses the native $q style notification: https://docs.angularjs.org/api/ng/service/$q
			myWorker.run().then(function(result) {
				// promise is resolved.
				console.log('done');
				
				$scope.AsyncProgress = 1.0;
				
			}, null, function(progress) {
				// promise has a notification
				$scope.AsyncProgress = progress / 100000;
			});
		}
		
		$scope.asyncTrainer = undefined;
		
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

		$scope.AsyncTrainer = function() {
			
			// function that will become a worker
			function async(currentPath, input, output, alpha, epochs, categories, tolerance, hiddenLayerNodes, threshold) {

				importScripts(currentPath + "js/Models.js");
				
				var normalizedData = Matrix.Normalize(input);
				
				var network = new DeepNeuralNetwork();
				var opts = new NeuralNetworkOptions(alpha, epochs, categories, normalizedData[0].length, normalizedData.length, tolerance, hiddenLayerNodes.length, false);
				
				network.SetupHiddenLayers(normalizedData[0].length, opts.Categories, hiddenLayerNodes);
				network.Setup(output, opts);
				
				// api to send a promise notification
				while (!network.Step(normalizedData, opts)) {
					
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
				$scope.asyncTrainer = Webworker.create(async, {async: true });

				// uses the native $q style notification: https://docs.angularjs.org/api/ng/service/$q
				$scope.asyncTrainer.run(currentPath, $scope.TrainingData, $scope.Output, $scope.LearningRate, $scope.Epochs, $scope.Categories, $scope.Tolerance, $scope.HiddenLayerNodes, $scope.Threshold).then(function(result) {
					
					$scope.Network = result.network;
					$scope.NetworkOptions = result.opts;
					
					// promise is resolved.
					console.log("Network");
					console.log($scope.Network);
					
					console.log("Network Options");
					console.log($scope.NetworkOptions);
					
					$scope.TrainingProgress = 1.0;
					
					$scope.Training = false;
					
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
		
	}]).directive("filelistBind", function() {
		
		return function( scope, elm, attrs ) {
			
			elm.bind("change", function( evt ) {
				
				scope.$apply(function( scope ) {
					
					scope[ attrs.name ] = evt.target.files;
					scope['TrainingUploadProgress'] = 0;
					scope['Items'] = 0;
					scope['Categories'] = 0;
					scope['Inputs'] = 0;
					scope['SelectedFile'] = evt.target.files[0];
				});
			});
		};
	});
