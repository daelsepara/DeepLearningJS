// Minimize a continuous differentialble multivariate function. Starting point
// is given by "X" (D by 1), and the function named in the string "f", must
// return a function value and a vector of partial derivatives. The Polack-
// Ribiere flavour of conjugate gradients is used to compute search directions,
// and a line search using quadratic and cubic polynomial approximations and the
// Wolfe-Powell stopping criteria is used together with the slope ratio method
// for guessing initial step sizes. Additionally a bunch of checks are made to
// make sure that exploration is taking place and that extrapolation will not
// be unboundedly large. The "length" gives the length of the run: if it is
// positive, it gives the maximum number of line searches, if negative its
// absolute gives the maximum allowed number of function evaluations. You can
// (optionally) give "length" a second component, which will indicate the
// reduction in function value to be expected in the first line-search (defaults
// to 1.0). The function returns when either its length is up, or if no further
// progress can be made (ie, we are at a minimum, or so close that due to
// numerical problems, we cannot get any closer). If the function terminates
// within a few iterations, it could be an indication that the function value
// and derivatives are not consistent (ie, there may be a bug in the
// implementation of your "f" function). The function returns the found
// solution "X", a vector of function values "fX" indicating the progress made
// and "i" the number of iterations (line searches or function evaluations,
// depending on the sign of "length") used.
//
// Usage: [X, fX, i] = fmincg(f, X, options)
//
// See also: checkgrad 
//
// Copyright (C) 2001 and 2002 by Carl Edward Rasmussen. Date 2002-02-13
//
//
// (C) Copyright 1999, 2000 & 2001, Carl Edward Rasmussen
// 
// Permission is granted for anyone to copy, use, or modify these
// programs and accompanying documents for purposes of research or
// education, provided this copyright notice is retained, and note is
// made of any changes that have been made.
// 
// These programs and documents are distributed without any warranty,
// express or implied.  As the programs were written for research
// purposes only, they have not been tested to the degree that would be
// advisable in any important application.  All use of these programs is
// entirely at the user's own risk.
//
// Original C# implementation by Peter Sergio Larsen to work with Accord.NET framework
// see: https://github.com/accord-net/framework/blob/master/Sources/Extras/Accord.Math.Noncommercial/NonlinearConjugateGradient.cs
//
// Changes by [sdsepara, 2018]: 
//
// 1) Function to minimize must return a result of type FuncOutput (see above)
// 2) success and ls_failed changed to type bool, and M to type int. 
// 3) modified to work with NeuralNetworkClassifier
// 4) each call to StepOptimizer executes just one cycle of optimization
// 5) implemented Multiply, Add, Copy helper functions
//
// JavaScript implementation by [sdsepara, 2019]
//
class Optimizer {
	
	constructor() {
		
		// RHO and SIG are the constants in the Wolfe-Powell conditions
		this.RHO = 0.01;
		this.SIG = 0.5;

		// don't reevaluate within 0.1 of the limit of the current bracket
		this.INT = 0.1;

		// extrapolate maximum 3 times the current bracket
		this.EXT = 3.0;

		// max 20 function evaluations per line search
		this.MAX = 20;

		// maximum allowed slope ratio
		this.RATIO = 100.0;

		// reduction parameter
		this.Red = 1.0;

		this.s = [];
		this.df1 = [];

		this.MaxIterations = 0;
		this.Iterations = 0;
		this.Evaluations = 0;

		this.length = 0;
		this.M = 0;
		this.iteration = 0;
		this.ls_failed = false;

		this.f1 = 0.0

		this.X0 = [];
		this.DF0 = [];

		this.d1 = 0.0;
		this.z1 = 0.0;
	}
	
	// Reshape Network Weights for use in optimizer
	ReshapeWeights(A) {
		
		var XX = [];

		if (A != null && A.length > 0) {
			
			for (var layer = 0; layer < A.length; layer++) {
				for (var x = 0; x < A[layer][0].length; x++) {
					for (var y = 0; y < A[layer].length; y++) {
						
						XX.push(A[layer][y][x]);
					}
				}
			}
		}

		return XX;
	}

	// Transform vector back into Network Weights
	RevertWeights(XX, A) {
		
		var index = 0;

		for (var layer = 0; layer < A.length; layer++) {
			for (var x = 0; x < A[layer][0].length; x++) {
				for (var y = 0; y < A[layer].length; y++) {
					
					if (index < XX.length)
						A[layer][y][x] = XX[index];

					index++;
				}
			}
		}
	}

	OptimizerCost(network, input, XX) {
		
		this.RevertWeights(XX, network.Weights);

		network.Forward(input);
		network.BackPropagation(input);

		XX = this.ReshapeWeights(network.Deltas);

		return {Cost: network.Cost, Gradient: XX};
	}

	SetupOptimizer(network, input, output, opts, Reset = true) {
		
		network.Setup(output, opts, Reset);

		this.MaxIterations = opts.Epochs;

		var XX = this.ReshapeWeights(network.Weights);

		this.Setup(network, input, XX);
	}

	StepOptimizer(network, input, opts) {
		
		var XX = this.ReshapeWeights(network.Weights);

		this.Step(network, input, XX);

		this.Cost = this.f1;

		return (isNaN(this.Cost) || this.Iterations >= opts.Epochs || (this.Cost) < opts.Tolerance);
	}
	
	Multiply(a, b) {
		
		var dot = 0.0;
		
        if (a.length == b.length) {

            for (var i = 0; i < a.length; i++)
                dot += a[i] * b[i];
        }

        return dot;
    }

    Add(dst, src, scale = 1.0) {
		
        if (dst.length == src.length) {
			
            for (var i = 0; i < dst.length; i++)
                dst[i] += scale * src[i];
        }
    }

    Copy(dst, src, scale = 1.0) {
		
        if (dst.length == src.length) {
			
            for (var i = 0; i < dst.length; i++)
				dst[i] = scale * src[i];
        }
    }
    
    Setup(network, input, X) {
		
        this.s = Matrix.Create(X.length);

        this.Evaluations = 0;
        this.Iterations = 0;

        this.length = this.MaxIterations;
        this.M = 0;
        this.iteration = 0; // zero the run length counter
        this.ls_failed = false; // no previous line search has failed

        // get function value and gradient
        var Eval = this.OptimizerCost(network, input, X);
        this.f1 = Eval.Cost;
        this.df1 = Eval.Gradient;

        this.Evaluations++;

        // count epochs?!
        if (this.length < 0)
            this.iteration++;

        // search direction is steepest
        this.Copy(this.s, this.df1, -1.0);

        // this is the slope
        this.d1 = -this.Multiply(this.s, this.s);

        // initial step is red / (|s|+1)
        this.z1 = this.Red / (1.0 - this.d1);

        this.X0 = Matrix.Create(X.length);
        this.DF0 = Matrix.Create(X.length);
    }

    Step(network, input, X) {
		
        // from R/Matlab smallest non-zero normalized floating point number
        var realmin = 2.225074e-308;

        // count iterations?!
        if (this.length > 0)
            this.iteration++;

        this.Iterations = this.iteration;

        // make a copy of current values
        this.Copy(this.X0, X);
        this.Copy(this.DF0, this.df1);

        var F0 = this.f1;

        // begin line search
        this.Add(X, this.s, this.z1);

        // evaluate cost - and gradient function with new params
        var Eval = this.OptimizerCost(network, input, X);
        
        var f2 = Eval.Cost;
        var df2 = Eval.Gradient;

        this.Evaluations++;

        // count epochs?!
        if (this.length < 0)
            this.iteration++;

        // initialize point 3 equal to point 1
        var d2 = this.Multiply(df2, this.s);

        var f3 = this.f1;
        var d3 = this.d1;
        var z3 = -this.z1;

        if (this.length > 0) {
			
            this.M = this.MAX;
        
        } else {
			
            this.M = Math.min(this.MAX, -this.length - this.iteration);
        }

        // initialize quantities
        var success = false;
        var limit = -1.0;

        while (true) {
			
            while (((f2 > this.f1 + this.z1 * this.RHO * this.d1) || (d2 > -this.SIG * this.d1)) && (this.M > 0)) {
				
                // tighten bracket
                limit = this.z1;

                var A = 0.0;
                var B = 0.0;
                var z2 = 0.0;

                if (f2 > this.f1) {
					
                    // quadratic fit 
                    z2 = z3 - ((0.5 * d3 * z3 * z3) / (d3 * z3 + f2 - f3));
                    
                } else {
					
                    // cubic fit
                    A = (6.0 * (f2 - f3)) / (z3 + (3.0 * (d2 + d3)));
                    B = (3.0 * (f3 - f2) - (z3 * ((d3 + 2.0) * d2)));

                    // numerical error possible - ok!
                    z2 = Math.sqrt(((B * B) - (A * d2 * z3)) - B) / A;
                }

                if (isNaN(z2) || !isFinite(z2)) {
					
                    // if we had a numerical problem then bisect
                    z2 = z3 / 2.0;
                }

                // don't accept too close to limit
                z2 = Math.max(Math.min(z2, this.INT * z3), (1.0 - this.INT) * z3);

                // update the step
                this.z1 = this.z1 + z2;

                this.Add(X, this.s, z2);

                Eval = this.OptimizerCost(network, input, X);
                f2 = Eval.Cost;
                df2 = Eval.Gradient;
                this.Evaluations++;

                this.M = this.M - 1;

                // count epochs?!
                if (this.length < 0)
                    this.iteration++;

                d2 = this.Multiply(df2, this.s);

                // z3 is now relative to the location of z2
                z3 = z3 - z2;
            }

            if (f2 > (this.f1 + this.z1 * this.RHO * this.d1) || d2 > (-this.SIG * this.d1)) {
				
                // this is a failure
                break;
            }

            if (d2 > (this.SIG * this.d1)) {
				
                // success
                success = true;

                break;
            }

            if (this.M == 0) {
				
                // failure
                break;
            }

            // make cubic extrapolation
            var A1 = 6.0 * (f2 - f3) / z3 + 3.0 * (d2 + d3);
            var B1 = 3.0 * (f3 - f2) - z3 * (d3 + 2.0 * d2);

            // num error possible - ok!
            var z21 = -d2 * z3 * z3 / (B1 + Math.sqrt(B1 * B1 - A1 * d2 * z3 * z3));

            if (z21 < 0.0) {
				
                z21 = z21 * -1.0;
            }

            // num prob or wrong sign?
            if (isNaN(z21) || !isFinite(z21) || z21 < 0) {
				
                // if we have no upper limit
                if (limit < -0.5) {
					
                    // then extrapolate the maximum amount
                    z21 = this.z1 * (this.EXT - 1.0);
                    
                } else {
					
                    // otherwise bisect
                    z21 = (limit - this.z1) / 2.0;
                }
                
            } else if (limit > -0.5 && (z21 + this.z1 > limit)) {
				
                // extrapolation beyond limit?

                // set to extrapolation limit
                z21 = (limit - this.z1) / 2.0;
                
            } else if (limit < -0.5 && (z21 + this.z1 > this.z1 * this.EXT)) {
				
                z21 = this.z1 * (this.EXT - 1.0);
                
            } else if (z21 < -z3 * this.INT) {
				
                // too close to limit?
                z21 = -z3 * this.INT;
                
            } else if ((limit > -0.5) && (z21 < (limit - this.z1) * (1 - this.INT))) {
				
                z21 = (limit - this.z1) * (1.0 - this.INT);
                
            }

            // set point 3 equal to point 2
            f3 = f2;
            d3 = d2;
            z3 = -z21;
            this.z1 = this.z1 + z21;

            // update current estimates
            this.Add(X, this.s, z21);

            // evaluate functions
            Eval = this.OptimizerCost(network, input, X);
            df2 = Eval.Gradient;
            f2 = Eval.Cost;

            this.M = this.M - 1;

            // count epochs?!
            this.iteration = this.iteration + (this.length < 0 ? 1 : 0);

            d2 = this.Multiply(df2, this.s);

            // end of line search
        }

        // if line searched succeeded 
        if (success) {
			
            this.f1 = f2;

            // Polack-Ribiere direction
            var part1 = this.Multiply(df2, df2);
            var part2 = this.Multiply(this.df1, df2);
            var part3 = this.Multiply(this.df1, this.df1);

            this.Copy(this.s, this.s, (part1 - part2) / part3);
            this.Add(this.s, df2, -1.0);

            // swap derivatives
            var tmp = this.df1;
            this.df1 = df2;
            df2 = tmp;

            // get slope
            d2 = this.Multiply(this.df1, this.s);

            // new slope must be negative 
            if (d2 > 0.0) {
				
                // use steepest direction
                this.Copy(this.s, this.df1, -1.0);

                d2 = -this.Multiply(this.s, this.s);
            }

            // slope ratio but max RATIO
            this.z1 = this.z1 * Math.min(this.RATIO, (this.d1 / (d2 - realmin)));

            this.d1 = d2;

            // this line search did not fail
            this.ls_failed = false;
            
        } else {
			
            // restore point from before failed line search
            this.f1 = this.F0;

            this.Copy(X, this.X0);
            this.Copy(this.df1, this.DF0);

            // line search twice in a row
            if (this.ls_failed || this.iteration > Math.abs(this.length)) {
				
                // or we ran out of time, so we give up
                return true;
            }

            // swap derivatives
            var tmp = this.df1;
            this.df1 = df2;
            df2 = tmp;

            // try steepest
            this.Copy(this.s, this.df1, -1.0);

            this.d1 = -this.Multiply(this.s, this.s);

            this.z1 = 1.0 / (1.0 - this.d1);

            // this line search failed
            this.ls_failed = true;
        }

        return !(this.iteration < Math.abs(this.length));
    }
};
