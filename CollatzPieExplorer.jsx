import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Calculator, Play } from 'lucide-react';

/**
 * CollatzPieExplorer Component
 * * An interactive application for exploring generalized Collatz sequences
 * (n -> n/X if even, n -> Y*n + Z if odd), including real/transcendental 
 * parameters and statistical analysis of the sequence's binary encoding.
 * * NOTE: Due to the use of standard JavaScript 'Number' for the generalized
 * calculation (which is necessary for non-integer inputs like pi and e), 
 * this implementation cannot handle the extreme precision or scale of
 * BigInt sequences.
 */
const App = () => {
  const [params, setParams] = useState({
    X: 2,
    Y: 3,
    Z: 1,
    n0: 27,
    maxIter: 1000,
    useTranscendental: false
  });
  
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('sequence');

  // Generalized Collatz function (uses standard JS numbers)
  const collatzStep = (n, X, Y, Z) => {
    // Note on integer vs. real:
    // This modulo check (n % X === 0) works reliably only for integers.
    // When transcendental parameters are used, 'n' becomes a float/real number,
    // and the sequence follows the odd rule (Y*n + Z) unless n is an almost
    // perfect multiple of X (which is highly unlikely).
    if (n % X === 0) {
      return n / X;
    }
    return (n * Y) + Z;
  };

  // Generate sequence
  const generateSequence = (n0, X, Y, Z, maxIter) => {
    const sequence = [n0];
    const seen = new Set([n0]);
    let current = n0;
    let cycleDetected = false;
    let cycleStart = -1;

    for (let i = 0; i < maxIter; i++) {
      current = collatzStep(current, X, Y, Z);
      
      // Safety check for stability
      if (current <= 0 || !isFinite(current)) {
        break;
      }

      sequence.push(current);
      
      // Cycle detection (may be problematic with floating point numbers)
      if (seen.has(current)) {
        cycleDetected = true;
        cycleStart = sequence.indexOf(current);
        break;
      }
      
      seen.add(current);

      if (current === 1) {
        break;
      }
    }

    return { sequence, cycleDetected, cycleStart };
  };

  // Binary encoding: encode whether value increased (1) or decreased (0)
  const encodeToBinary = (sequence) => {
    const binary = [];
    for (let i = 1; i < sequence.length; i++) {
      // Small epsilon check could be added here for float stability, but keeping it simple for now.
      binary.push(sequence[i] > sequence[i - 1] ? 1 : 0);
    }
    return binary;
  };

  // Frequency test (Monobit test)
  const frequencyTest = (binary) => {
    const sum = binary.reduce((a, b) => a + b, 0);
    const n = binary.length;
    if (n === 0) return { statistic: 0, passed: true };
    const s = Math.abs(sum - n / 2) / Math.sqrt(n / 4);
    return { statistic: s, passed: s < 1.96 }; // 95% confidence (Z < 1.96)
  };

  // Runs test
  const runsTest = (binary) => {
    if (binary.length < 2) return { runs: 0, expected: 0, statistic: 0, passed: true };
    
    let runs = 1;
    for (let i = 1; i < binary.length; i++) {
      if (binary[i] !== binary[i - 1]) runs++;
    }
    
    const n1 = binary.filter(b => b === 1).length;
    const n0 = binary.length - n1;
    const n = binary.length;

    // Check for trivial sequences (all 0s or all 1s)
    if (n1 === 0 || n0 === 0) return { runs: runs, expected: 1, statistic: 0, passed: true };
    
    const expectedRuns = (2 * n1 * n0) / n + 1;
    const variance = (2 * n1 * n0 * (2 * n1 * n0 - n)) / 
                     (Math.pow(n, 2) * (n - 1));

    if (variance <= 0) return { runs: runs, expected: expectedRuns, statistic: 0, passed: true };
    
    const z = Math.abs(runs - expectedRuns) / Math.sqrt(variance);
    
    return { runs, expected: expectedRuns, statistic: z, passed: z < 1.96 };
  };

  // Shannon entropy
  const calculateEntropy = (binary) => {
    const n = binary.length;
    if (n === 0) return 0;
    
    const n1 = binary.filter(b => b === 1).length;
    const p1 = n1 / n;
    const p0 = 1 - p1;
    
    if (p0 === 0 || p1 === 0) return 0;
    return -(p0 * Math.log2(p0) + p1 * Math.log2(p1));
  };

  const runAnalysis = () => {
    const X = params.X;
    // Apply transcendental constants if the checkbox is marked
    const Y = params.useTranscendental ? Math.PI : params.Y;
    const Z = params.useTranscendental ? Math.E : params.Z;
    
    const { sequence, cycleDetected, cycleStart } = generateSequence(
      params.n0, X, Y, Z, params.maxIter
    );

    const binary = encodeToBinary(sequence);
    
    // Only run tests if the binary sequence is long enough
    let freqTest = { statistic: 0, passed: true };
    let runsTestResult = { runs: 0, expected: 0, statistic: 0, passed: true };
    if (binary.length > 50) {
        freqTest = frequencyTest(binary);
        runsTestResult = runsTest(binary);
    }
    
    const entropy = calculateEntropy(binary);

    setResults({
      sequence,
      cycleDetected,
      cycleStart,
      binary,
      tests: {
        frequency: freqTest,
        runs: runsTestResult,
        entropy
      },
      params: { X, Y, Z, n0: params.n0 }
    });
  };

  // Prepare sequence data for Line Chart (log scale for better visualization)
  const sequenceData = useMemo(() => {
    if (!results) return [];
    // Limit to 200 steps for clean chart rendering
    return results.sequence.slice(0, 200).map((value, index) => ({
      step: index,
      value: Math.log10(value + 1)
    }));
  }, [results]);

  // Prepare binary data for Scatter Chart
  const binaryData = useMemo(() => {
    if (!results) return [];
    // Limit to 200 steps for clean chart rendering
    return results.binary.slice(0, 200).map((value, index) => ({
      step: index,
      value
    }));
  }, [results]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header and Controls Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Collatz $\pi$ Explorer</h1>
          </div>
          
          <p className="text-gray-600 mb-6">
            Explore generalized Collatz sequences ($n/X$ if even, $Yn+Z$ if odd) with real and transcendental parameters, and analyze their randomness properties.
          </p>

          {/* Controls Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">X (Divisor)</label>
              <input
                type="number"
                value={params.X}
                onChange={(e) => setParams({...params, X: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            {!params.useTranscendental && (
                <>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Y (Multiplier)</label>
                    <input
                      type="number"
                      value={params.Y}
                      onChange={(e) => setParams({...params, Y: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Z (Addition)</label>
                    <input
                      type="number"
                      value={params.Z}
                      onChange={(e) => setParams({...params, Z: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Initial Value ($n_0$)</label>
              <input
                type="number"
                value={params.n0}
                onChange={(e) => setParams({...params, n0: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Max Iter</label>
              <input
                type="number"
                value={params.maxIter}
                onChange={(e) => setParams({...params, maxIter: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.useTranscendental}
                onChange={(e) => setParams({...params, useTranscendental: e.target.checked})}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Use Transcendental Parameters (Y=$\pi$, Z=$e$)
              </span>
            </label>

            <button
              onClick={runAnalysis}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Play className="w-4 h-4" />
              Run Analysis
            </button>
          </div>
        </div>

        {results && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Sequence Length</div>
                <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{results.sequence.length}</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Cycle Detected</div>
                <div className="text-2xl sm:text-3xl font-bold text-purple-600">
                  {results.cycleDetected ? 'Yes' : 'No'}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Shannon Entropy</div>
                <div className="text-2xl sm:text-3xl font-bold text-pink-600">
                  {results.tests.entropy.toFixed(3)}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Final Value</div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                  {results.sequence[results.sequence.length - 1].toFixed(4)}
                </div>
              </div>
            </div>

            {/* Tabs & Visualization */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex border-b overflow-x-auto">
                <button
                  onClick={() => setActiveTab('sequence')}
                  className={`flex-shrink-0 px-4 sm:px-6 py-3 font-medium transition-colors text-sm ${
                    activeTab === 'sequence' 
                      ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Sequence Plot
                </button>
                <button
                  onClick={() => setActiveTab('binary')}
                  className={`flex-shrink-0 px-4 sm:px-6 py-3 font-medium transition-colors text-sm ${
                    activeTab === 'binary' 
                      ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Binary Encoding
                </button>
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`flex-shrink-0 px-4 sm:px-6 py-3 font-medium transition-colors text-sm ${
                    activeTab === 'tests' 
                      ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Randomness Tests
                </button>
              </div>

              <div className="p-4 sm:p-8">
                {activeTab === 'sequence' && (
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
                      Sequence Evolution (log$_{10}$ scale)
                    </h3>
                    <div className="h-[300px] sm:h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sequenceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis dataKey="step" label={{ value: 'Step (Max 200)', position: 'insideBottom', offset: 0, fill: '#6b7280' }} tick={{ fontSize: 10 }} />
                          <YAxis label={{ value: 'log$_{10}$(value + 1)', angle: -90, position: 'insideLeft', fill: '#6b7280' }} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            formatter={(value) => [`${value.toFixed(4)}`, 'log$_{10}$(value + 1)']} 
                            labelFormatter={(label) => `Step: ${label}`}
                          />
                          <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} animationDuration={500} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {activeTab === 'binary' && (
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
                      Binary Sequence (1=increase, 0=decrease)
                    </h3>
                    <div className="h-[300px] sm:h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis dataKey="step" label={{ value: 'Step (Max 200)', position: 'insideBottom', offset: 0, fill: '#6b7280' }} tick={{ fontSize: 10 }} />
                          <YAxis domain={[-0.2, 1.2]} ticks={[0, 1]} label={{ value: 'Value', angle: -90, position: 'insideLeft', fill: '#6b7280' }} tickFormatter={(tick) => (tick === 1 ? 'Increase (1)' : 'Decrease (0)')} />
                          <Tooltip />
                          <Scatter data={binaryData} fill="#8b5cf6" shape="circle" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                      <p className="text-sm font-semibold mb-2 text-gray-700">Full Binary Sequence (First 100 characters shown):</p>
                      <div className="font-mono text-xs sm:text-sm break-all">
                        {results.binary.slice(0, 100).join('')}
                        {results.binary.length > 100 && '...'}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tests' && (
                  <div className="space-y-6">
                    
                    {/* Frequency Test */}
                    <div className="border-l-4 border-indigo-500 pl-4 bg-indigo-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg text-gray-800 mb-2">Frequency Test (Monobit)</h4>
                      <p className="text-gray-600 mb-2 text-sm">Tests if the proportion of 0s and 1s is roughly equal.</p>
                      <div className="space-y-1 text-sm">
                        <div>Z-Statistic: <span className="font-mono font-semibold text-indigo-800">{results.tests.frequency.statistic.toFixed(4)}</span></div>
                        <div>
                          Result: <span className={`font-bold ${results.tests.frequency.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {results.tests.frequency.passed ? '✓ PASS (Random)' : '✗ FAIL (Non-Random)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Runs Test */}
                    <div className="border-l-4 border-purple-500 pl-4 bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg text-gray-800 mb-2">Runs Test</h4>
                      <p className="text-gray-600 mb-2 text-sm">Tests if the number of runs (consecutive 0s or 1s) is consistent with a random sequence.</p>
                      <div className="space-y-1 text-sm">
                        <div>Observed Runs: <span className="font-mono font-semibold text-purple-800">{results.tests.runs.runs}</span></div>
                        <div>Expected Runs: <span className="font-mono">{results.tests.runs.expected.toFixed(2)}</span></div>
                        <div>Z-statistic: <span className="font-mono font-semibold text-purple-800">{results.tests.runs.statistic.toFixed(4)}</span></div>
                        <div>
                          Result: <span className={`font-bold ${results.tests.runs.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {results.tests.runs.passed ? '✓ PASS (Random)' : '✗ FAIL (Non-Random)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shannon Entropy */}
                    <div className="border-l-4 border-pink-500 pl-4 bg-pink-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg text-gray-800 mb-2">Shannon Entropy</h4>
                      <p className="text-gray-600 mb-2 text-sm">Measures the information content (closer to 1.0 means higher uncertainty/randomness).</p>
                      <div className="space-y-1 text-sm">
                        <div>Entropy: <span className="font-mono font-semibold text-pink-800">{results.tests.entropy.toFixed(4)}</span></div>
                        <div>Max Entropy: <span className="font-mono">1.0000</span></div>
                        <div>
                          Randomness Score: <span className="font-bold text-indigo-600">
                            {(results.tests.entropy * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 pt-4 border-t mt-4">
                        Statistical tests are only executed if the binary sequence length exceeds 50 steps. Test results assume a 95% confidence level.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;

