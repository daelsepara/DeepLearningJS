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
		
		$scope.AsyncTrainer = function() {
			
			// function that will become a worker
			function async(input, output, alpha, epochs, categories, tolerance, hiddenLayerNodes, threshold) {

				// static class methods for matrix operations
				class Matrix {
					
					// https://stackoverflow.com/questions/966225/how-can-i-create-a-two-dimensional-array-in-javascript
					static Create(length) {
						
						var arr = new Array(length || 0);
						var i = length;

						if (arguments.length > 1) {
							
							var args = Array.prototype.slice.call(arguments, 1);
							
							while(i--)
								arr[length-1 - i] = this.Create.apply(this, args);
						}

						return arr;
					}
					
					// see: https://blog.andrewray.me/how-to-clone-a-nested-array-in-javascript/
					static Clone(arr) {

						var i, copy;

						if (Array.isArray(arr)) {
							
							copy = arr.slice(0);
							
							for( i = 0; i < copy.length; i++ ) {
								
								copy[i] = this.Clone(copy[i]);
							}
							
							return copy;
							
						} else if (typeof arr === 'object' ) {
							
							throw 'Cannot clone array containing an object!';
							
						} else {
							
							return arr;
						}
					}
					
					static MemCopy(dst, dstoffset, src,  srcoffset, count) {
						
						for (var i = 0; i < count; i++)
							dst[dstoffset + i] = src[srcoffset + i];
					}
					
					// Copy 2D[minx + x][miny + y]
					static Copy2D(dst, src, minx, miny) {
						
						if (miny >= 0 & miny < src.length) {
							
							for (var y = 0; y < dst.length; y++) {
								
								this.MemCopy(dst[y], 0, src[y], minx, dst[0].length);
							}
						}
					}
				
					// Copy 2D[x][y] to 2D[minx + x][miny + y]
					static Copy2DOffset(dst, src, minx, miny) {
						
						if (miny >= 0 & miny < dst.length & src.length > 0) {
							
							for (var y = 0; y < src.length; y++) {
								
								this.MemCopy(dst[y], minx, src[y], 0, src[0].length);
							}
						}
					}
					
					// transposition
					static Transpose(src) {
						
						var srcy = src.length;
						var srcx = src[0].length;

						if (srcy > 1 && srcx > 1) {
						
							var dst = this.Create(srcx, srcy);
							
							for (var y = 0; y < srcy; y++) {
								for (var x = 0; x < srcx; x++) {
									
									dst[x][y] = src[y][x];
								}
							}
							
							return dst;
							
						} else if (srcy > 1 && srcx == 1) {
							
							var dst = this.Create(1, srcy);
							
							for (var y = 0; y < srcy; y++) {
								
								dst[y] = src[y][0];
							}
							
							return [dst];
							
						} else if (srcx > 1 && srcy == 1) {
							
							var dst = this.Create(srcx, 1);
							
							for (var x = 0; x < srcx; x++) {
								
								dst[x][0] = [src[0][x]];
							}
							
							return dst;
						}
					}
					
					// 2D matrix multiplication - naive version
					static Multiply(A, B) {
						
						var Ax = A[0].length, Ay = A.length;
						var Bx = B[0].length, By = B.length;
						
						if (Ax == By) {
							
							var result = this.Create(Ay, Bx);

							for (var y = 0; y < Ay; y++) {
								for (var x = 0; x < Bx; x++) {
									
									result[y][x] = 0;

									for (var k = 0; k < Ax; k++) {
										
										result[y][x] += A[y][k] * B[k][x];
									}
								}
							}
							
							return result;
						}
					}
					
					// element by element multiplication
					static Product(A, B) {
						
						var Ax = A[0].length, Ay = A.length;
						var Bx = B[0].length, By = B.length;
						
						if (Ax == Bx && Ay == By) {
							
							var result = this.Create(Ay, Ax);

							for (var y = 0; y < Ay; y++) {
								for (var x = 0; x < Ax; x++) {
									
									result[y][x] = Ax > 1 ? A[y][x] * B[y][x] : [A[y][x] * B[y][x]];
								}
							}
							
							return result;
						}
					}
					
					// matrix * constant multiplication
					static MultiplyConstant(A, constant = 1.0) {
						
						var Ax = A[0].length, Ay = A.length;
						
						var result = this.Create(Ay, Ax);

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								result[y][x] = constant * A[y][x];
							}
						}
							
						return result;
					}
					
					// matrix addition with scaling
					static Add(A, B, Scale = 1.0) {
						
						var Ax = A[0].length, Ay = A.length;
						var Bx = B[0].length, By = B.length;
						
						if (Ax == Bx && Ay == By) {
							
							var result = this.Create(Ay, Ax);

							for (var y = 0; y < Ay; y++) {
								for (var x = 0; x < Ax; x++) {
									
									result[y][x] = A[y][x] + Scale * B[y][x];
								}
							}
							
							return result;
						}
					}
					
					// matrix + constant addition
					static AddConstant(A, constant = 0.0) {
						
						var Ax = A[0].length, Ay = A.length;
						
						var result = this.Create(Ay, Ax);

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								result[y][x] = A[y][x] + constant;
							}
						}
							
						return result;
					}
					
					// matrix summation
					static Sum(A) {
						
						var sum = 0.0;

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								sum += A[y][x];
							}
						}

						return sum;
					}
					
					// get sum of squares of each element
					static SquareSum(A) {
						
						var sum = 0.0;

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								sum += A[y][x] * A[y][x];
							}
						}

						return sum;
					}
					
					// mean of 2D array along a dimension
					static Mean(src, dim) {
						
						if (dim === 1) {
							
							var result = this.Create(src[0].length);
							
							for (var x = 0; x < src[0].length; x++) {
								
								var sum = 0.0;

								for (var y = 0; y < src.length; y++) {
									
									sum += src[y][x];
								}

								result[x] = sum / src.length;
							}
							
							return result;
							
						} else {
							
							var result = this.Create(src.length);

							for (var y = 0; y < src.length; y++) {
								
								var sum = 0.0;

								for (var x = 0; x < src[0].length; x++) {
									
									sum += src[y][x];
								}

								result[y] = sum / src[0].length;
							}
							
							return result;
						}
					}
					
					// sigmoid function
					static Sigmoid(x) {
						
						return 1.0 / (1.0 + Math.exp(-x));
					}
					
					// get element per element difference between arrays
					static Diff(A, B) {
						
						var Ax = A[0].length, Ay = A.length;
						var Bx = B[0].length, By = B.length;

						if (Ax == Bx && Ay == By) {
							
							var result = this.Create(Ay, Ax);
							
							for (var y = 0; y < Ay; y++) {
								for (var x = 0; x < Ax; x++) {
									
									result[y][x] = A[y][x] - B[y][x];
								}
							}
							
							return result;
						}
					}
					
					// apply sigmoid function to matrix
					static Sigm(A) {
						
						var Ax = A[0].length, Ay = A.length;
						
						var result = this.Create(Ay, Ax);

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								result[y][x] = this.Sigmoid(A[y][x]);
							}
						}
							
						return result;
					}
					
					// apply delta sigmoid function to matrix
					static DSigm(A) {
						
						var Ax = A[0].length, Ay = A.length;
						
						var result = this.Create(Ay, Ax);

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								var sigmoid = this.Sigmoid(A[y][x]);
								
								result[y][x] = sigmoid * (1.0 - sigmoid);
							}
						}
							
						return result;
					}
					
					// combine two arrays column-wise
					static CBind(A, B) {
						
						var Ax = A[0].length, Ay = A.length;
						var Bx = B[0].length, By = B.length;
						
						if (Ay == By) {
							
							var resultx = Ax + Bx;
							var resulty = Ay;

							var result = this.Create(resulty, resultx);

							this.Copy2DOffset(result, A, 0, 0);
							this.Copy2DOffset(result, B, Ax, 0);
						
							return result;
						}
					}
					
					// flip 3D matrix along a dimension
					static Flip(src, FlipDim) {

						var srcz = src.length;
						var srcy = src[0].length;
						var srcx = src[0][0].length;
						
						var result = this.Create(srcz, srcy, srcx);

						for (var z = 0; z < srcz; z++) {
							for (var y = 0; y < srcy; y++) {
								for (var x = 0; x < srcx; x++) {
									
									switch (FlipDim) {
										
										case 0:
										
											result[z][y][x] = src[z][y][srcx - x - 1];
											
											break;
											
										case 1:
										
											result[z][y][x] = src[z][srcy - y - 1][x];
											
											break;
											
										case 2:
										
											result[z][y][x] = src[srcz - z - 1][y][x];
											
											break;
											
										default:
										
											result[z][y][x] = src[z][y][srcx - x - 1];
											
											break;
									}
								}
							}
						}
						
						return result;
					}
					
					// flip 2D matrix along a dimension
					static Flip2D(src, FlipDim) {

						var srcy = src.length;
						var srcx = src[0].length;
						
						var result = this.Create(srcy, srcx);

						for (var y = 0; y < srcy; y++) {
							for (var x = 0; x < srcx; x++) {
								
								switch (FlipDim) {
									
									case 0:
									
										result[y][x] = src[y][srcx - x - 1];
										
										break;
										
									case 1:
									
										result[y][x] = src[srcy - y - 1][x];
										
										break;
										
									default:
									
										result[y][x] = src[y][srcx - x - 1];
										
										break;
								}
							}
						}
						
						return result;
					}
					
					// flip 3D matrix in all dimensions
					static FlipAll(src) {
						
						var srcz = src.length;
						var srcy = src[0].length;
						var srcx = src[0][0].length;
						
						var result = this.Create(srcz, srcy, srcx);
						var tmp = this.Clone(src);

						for (var FlipDim = 0; FlipDim < 3; FlipDim++) {
							
							result = this.Flip(tmp, FlipDim);
							
							tmp = this.Clone(result);
						}
						
						return result;
					}
					
					// rotate a 2D matrix
					static Rotate180(src) {
						
						var result = this.Create(src.length, src[0].length);
						var tmp = this.Clone(src);

						for (var FlipDim = 0; FlipDim < 2; FlipDim++) {
							
							result = this.Flip2D(tmp, FlipDim);
							
							tmp = this.Clone(result);
						}

						return result;
					}
					
					// expand a matrix A[x][y] by [ex][ey]
					static Expand(A, expandx, expandy) {
						
						var outputx = A[0].length * expandx;
						var outputy = A.length * expandy;

						var output = this.Create(outputy, outputx);

						for (var y = 0; y < A.length; y++) {
							for (var x = 0; x < A[0].length; x++) {
								for (var SZy = 0; SZy < expandy; SZy++) {
									for (var SZx = 0; SZx < expandx; SZx++) {
										
										output[y * expandy + SZy][x * expandx + SZx] = A[y][x];
									}
								}
							}
						}
						
						return output;
					}
					
					// Transforms x into a column vector
					static Vector(x) {
						
						var temp = this.Transpose(x);

						var result = this.Create(x.length * x[0].length);
						
						var i = 0;
						
						for (var y = 0; y < temp.length; y++) {
							for (var x = 0; x < temp[0].length; x++) {
								
								result[i] = temp[y][x];
								
								i++;
							}
						}
						
						return result;
					}
				
					// get sum of elements per row
					static RowSums(A) {
						
						var result = this.Create(A.length);

						for (var i = 0; i < A.length; i++) {
							
							result[i] = 0.0;

							for (var j = 0; j < A[0].length; j++) {
								
								result[i] += A[i][j];
							}
						}

						return result;
					}
					
					// get sum of elements per column
					static ColSums(A) {
						
						var result = this.Create(A[0].length);

						for (var j = 0; j < A[0].length; j++) {
							
							result[j] = 0.0;

							for (var i = 0; i < A.length; i++) {
								
								result[j] += A[i][j];
							}
						}

						return result;
					}
					
					// create a 2D diagonal/identity matrix of size [dim][dim]
					static Diag(dim) {
						
						if (dim > 0) {
							
							var result = this.Create(dim, dim);

							for (var y = 0; y < dim; y++) {
								for (var x = 0; x < dim; x++) {
									
									result[y][x] = (x == y) ? 1 : 0;
								}
							}

							return result;
						}
					}
					
					// compute the square root of each element in the 2D array
					static Sqrt(A) {
						
						var Ax = A[0].length, Ay = A.length;

						var result = this.Create(Ay, Ax);

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								result[y][x] = Math.sqrt(A[y][x]);
							}
						}
							
						return result;	
					}
					
					static Set(A, value = 0.0) {
						
						var Ax = A[0].length, Ay = A.length;

						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								A[y][x] = value;
							}
						}
					}
				};
				
				class NeuralNetworkOptions {
					
					constructor(alpha, epochs, categories, inputs, items, tolerance, hiddenLayers, useL2 = false) {
						
						this.Alpha = alpha;
						this.Epochs = epochs;
						this.Inputs = inputs; // Input layer features (i)
						this.Items = items;  // number of input items
						this.Categories = categories; // number of output categories (k)
						this.Tolerance = tolerance;
						this.HiddenLayers = hiddenLayers < 1 || hiddenLayers == undefined ? 1 : hiddenLayers;
						this.UseL2 = useL2;
					}
				}
				
				class HiddenLayer {
					
					constructor(inputs, outputs) {

						this.Inputs = inputs;
						this.Outputs = outputs;
					}
				};

				class DeepNeuralNetwork {

					constructor() {

						this.Layers = [];
						this.Weights = [];
						this.Deltas = [];

						this.Y = [];
						this.Y_true = [];

						// intermediate results
						this.X = [];
						this.Z = [];

						// internal use
						this.Activations = [];
						this.D = [];

						// Error
						this.Cost = 0.0;
						this.L2 = 0.0;

						this.Iterations = 0;
					}
					
					Forward(input) {
						
						// create bias column
						var InputBias = Matrix.Create(input.length, 1);
						Matrix.Set(InputBias, 1.0);

						// compute input activations
						var last = this.Weights.length - 1;

						for (var layer = 0; layer < this.Weights.length; layer++) {
							
							var XX = layer == 0 ? Matrix.CBind(InputBias, input) : Matrix.CBind(InputBias, this.Activations[layer - 1]);
							var tW = Matrix.Transpose(this.Weights[layer]);
							var ZZ = Matrix.Multiply(XX, tW);

							this.X[layer] = XX;
							this.Z[layer] = ZZ;

							if (layer != last) {
								
								this.Activations[layer] = Matrix.Sigm(ZZ);
								
							} else {
								
								this.Y = Matrix.Sigm(ZZ);
							}
						}
					}
					
					// backward propagation
					BackPropagation(input) {
						
						var last = this.Weights.length - 1;
						
						this.D[0] = Matrix.Diff(this.Y, this.Y_true);

						var current = 1;

						for (var layer = last - 1; layer >= 0; layer--) {
							
							var prev = current - 1;

							var W = Matrix.Create(this.Weights[layer + 1].length, this.Weights[layer + 1][0].length - 1);
							var DZ = Matrix.DSigm(this.Z[layer]);
							
							Matrix.Copy2D(W, this.Weights[layer + 1], 1, 0);
							
							this.D[current] = Matrix.Multiply(this.D[prev], W);
							this.D[current] = Matrix.Product(this.D[current], DZ);

							current++;
						}
						
						for (var layer = 0; layer < this.Weights.length; layer++) {
							
							var tD = Matrix.Transpose(this.D[this.Weights.length - layer - 1]);
							this.Deltas[layer] = Matrix.Multiply(tD, this.X[layer]);
							this.Deltas[layer] = Matrix.MultiplyConstant(this.Deltas[layer], 1.0 / input.length);
						}
						
						this.Cost = 0.0;
						this.L2 = 0.0;
						
						for (var y = 0; y < this.Y_true.length; y++) {
							for (var x = 0; x < this.Y_true[0].length; x++) {
								this.L2 += 0.5 * (this.D[0][y][x] * this.D[0][y][x]);
								this.Cost += (-this.Y_true[y][x] * Math.log(this.Y[y][x]) - (1 - this.Y_true[y][x]) * Math.log(1 - this.Y[y][x]));
							}
						}
						
						this.Cost /= input.length;
						this.L2 /= input.length;
					}
					
					ApplyGradients(opts) {
						
						for (var layer = 0; layer < this.Weights.length; layer++) {
							
							this.Weights[layer] = Matrix.Add(this.Weights[layer], this.Deltas[layer], -opts.Alpha);
						}
					}
					
					Rand(Ax, Ay) {
						
						var result = Matrix.Create(Ay, Ax);
						
						for (var y = 0; y < Ay; y++) {
							for (var x = 0; x < Ax; x++) {
								
								result[y][x] = (Math.random() - 0.5) * 2.0;
							}
						}
						
						return result;
					}
					
					Labels(output, opts) {
						
						var result = Matrix.Create( opts.Items, opts.Categories);
						var eye_matrix = Matrix.Diag(opts.Categories);

						for (var y = 0; y < opts.Items; y++) {
							
							if (opts.Categories > 1) {
								
								for (var x = 0; x < opts.Categories; x++) {
									
									result[y][x] = eye_matrix[Math.abs(parseInt(output[y])) - 1][x];
								}
								
							} else {
								
								result[y] = output[y];
							}
						}

						return result;
					}
					
					Predict(test, opts) {
						
						this.Forward(test);

						var prediction = Matrix.Create(test.length);

						for (var y = 0; y < test.length; y++) {
							
							if (opts.Categories > 1) {
								
								var maxval = Number.MIN_VALUE;

								for (var x = 0; x < opts.Categories; x++) {
									
									var val = this.Y[y][x];

									if (val > maxval) {
										
										maxval = val;
									}
								}

								prediction[y] = [maxval];
								
							} else {
								
								prediction[y] = this.Y[y];
							}
						}
						
						return prediction;
					}
					
					Classify(test, opts, threshold = 0.5) {
						
						this.Forward(test);

						var classification = Matrix.Create(test.length);

						for (var y = 0; y < test.length; y++) {
							
							if (opts.Categories > 1) {
								
								var maxval = Number.MIN_VALUE;
								var maxind = 0;

								for (var x = 0; x < opts.Categories; x++) {
									
									var val = this.Y[y][x];

									if (val > maxval) {
										
										maxval = val;
										maxind = x;
									}
								}

								classification[y] = [maxind + 1];
								
							} else {
								
								classification[y] = this.Y[y] > threshold ? [1] : [0];
							}
						}

						return classification;
					}
					
					SetupLabels(output, opts) {
						
						this.Y_true = this.Labels(output, opts);
					}
					
					SetupHiddenLayers(inputs, categories, LayerNodes) {
						
						if (LayerNodes.length > 0) {
							
							this.Layers = [];

							this.Layers.push(new HiddenLayer(inputs, LayerNodes[0]));

							for (var layer = 1; layer < LayerNodes.length; layer++) {
								
								this.Layers.push(new HiddenLayer(LayerNodes[layer - 1], LayerNodes[layer]));
							}

							this.Layers.push(new HiddenLayer(LayerNodes[LayerNodes.length - 1], categories));
						}
					}
					
					Setup(output, opts, Reset = true) {
						
						if (Reset) {
							
							if (this.Activations != undefined && this.Activations.length > 0) {
								
								for (var layer = 0; layer < this.Activations.length; layer++) {
									
									this.Activations[layer] = [];
								}
							}

							if (this.D != undefined && this.D.length > 0) { 
								
								for (var layer = 0; layer < this.D.length; layer++) {
									
									this.D[layer] = [];
								}
							}

							if (this.Deltas != undefined && this.Deltas.length > 0) {
								
								for (var layer = 0; layer < this.Deltas.length; layer++) {
									
									this.Deltas[layer] = [];
								}
							}

							if (this.X != undefined && this.X.length > 0) {
								
								for (var layer = 0; layer < this.X.length; layer++) {
									
									this.X[layer] = [];
								}
							}
							
							if (this.Z != undefined && this.Z.length > 0) {
								
								for (var layer = 0; layer < this.Z.length; layer++) {
									
									this.Z[layer] = [];
								}
							}
							
							if (this.Weights != undefined && this.Weights.length > 0) {
								
								for (var layer = 0; layer < this.Weights.length; layer++) {
									
									this.Weights[layer] = [];
								}
							}
							
							if (this.Layers.length > 0) {
								
								this.Weights = Matrix.Create(this.Layers.length);
			 
								for (var layer = 0; layer < this.Layers.length; layer++) {
									
									this.Weights[layer] = Matrix.Create(this.Layers[layer].Outputs, this.Layers[layer].Inputs + 1);
								}
								
							} else {
								
								this.Weights = Matrix.Create(opts.HiddenLayers + 1);

								this.Weights[0] = Matrix.Create(opts.Inputs + 1, opts.Nodes);

								for (var layer = 1; layer < opts.HiddenLayers; layer++) {
									
									this.Weights[layer] = Matrix.Create(opts.Nodes + 1, opts.Nodes);
								}

								this.Weights[opts.HiddenLayers] = Matrix.Create(opts.Categories, opts.Nodes + 1);
							}
						}

						this.Activations = Matrix.Create(opts.HiddenLayers);
						this.Deltas = Matrix.Create(opts.HiddenLayers + 1);
						this.X = Matrix.Create(opts.HiddenLayers + 1);
						this.D = Matrix.Create(opts.HiddenLayers + 1);
						this.Z = Matrix.Create(opts.HiddenLayers + 1);

						this.SetupLabels(output, opts);

						if (Reset && this.Weights != undefined) {
							
							for (var layer = 0; layer < opts.HiddenLayers + 1; layer++) {
								
								this.Weights[layer] = this.Rand(this.Weights[layer][0].length, this.Weights[layer].length);
							}
						}

						this.Cost = 1.0;
						this.L2 = 1.0;

						this.Iterations = 0;
					}
					
					// perform one iteration of training
					Step(input, opts) {
						
						this.Forward(input);
						this.BackPropagation(input);

						var optimized = (isNaN(opts.UseL2 ? this.L2 : this.Cost) || (opts.UseL2 ? this.L2 : this.Cost) < opts.Tolerance);

						// Apply gradients only if the error is still high
						if (!optimized) {
							
							this.ApplyGradients(opts);
						}

						this.Iterations++;

						return (optimized || this.Iterations >= opts.Epochs);
					}
					
					// train network
					Train(input, output, opts) {
						
						this.Setup(output, opts);

						while (!this.Step(input, opts)) { }
					}
				};

				var network = new DeepNeuralNetwork();
				var opts = new NeuralNetworkOptions(alpha, epochs, categories, input[0].length, input.length, tolerance, hiddenLayerNodes.length, false);
				
				network.SetupHiddenLayers(input[0].length, opts.Categories, hiddenLayerNodes);
				network.Setup(output, opts);
				
				// api to send a promise notification
				while (!network.Step(input, opts)) {
					
					notify({Iterations: network.Iterations, L2: network.L2, Cost: network.Cost});
				}
				
				// api to resolve the promise. Note: according to the $q spec, 
				// a promise cannot be used once it has been resolved or rejected.
				complete({network: network, opts: opts});
			}
			
			if ($scope.Items > 0 && $scope.Inputs > 0 && $scope.Categories > 0 && $scope.HiddenLayerNodes.length > 0 && $scope.TrainingData.length > 0 && $scope.Output.length > 0) {
				
				// mark this worker as one that supports async notifications
				var asyncTrainer = Webworker.create(async, {async: true });

				// uses the native $q style notification: https://docs.angularjs.org/api/ng/service/$q
				asyncTrainer.run($scope.TrainingData, $scope.Output, $scope.LearningRate, $scope.Epochs, $scope.Categories, $scope.Tolerance, $scope.HiddenLayerNodes, $scope.Threshold).then(function(result) {
					
					$scope.Network = result.network;
					$scope.NetworkOptions = result.opts;
					
					// promise is resolved.
					console.log("Network");
					console.log($scope.Network);
					
					console.log("Network Options");
					console.log($scope.opts);
					
					$scope.TrainingProgress = 1.0;
					
				}, null, function(network) {
					
					// promise has a notification
					$scope.TrainingProgress = network.Iterations / $scope.Epochs;
					$scope.Network.L2 = network.L2;
					$scope.Network.Iterations = network.Iterations;
					$scope.Network.Cost = network.Cost;
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
