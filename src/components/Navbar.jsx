import React from 'react';
import useStructureStore from '../store/useStructureStore';
import { Play, Moon, Sun, Activity, Download, Settings, RefreshCw, FolderOpen, Sparkles } from 'lucide-react';

const Navbar = () => {
  const {
    structureType,
    setStructureType,
    unitSystem,
    setUnitSystem,
    runAnalysis,
    theme,
    toggleTheme,
    clearAll,
    loadExample,
    isAnalyzing,
    hasResults,
    setActiveTab,
    toggleAIAssistant
  } = useStructureStore();

  const handleExampleChange = (e) => {
    if (e.target.value) {
      loadExample(e.target.value);
      e.target.value = ""; // Reset dropdown
    }
  };

  return (
    <nav className="glass-card m-4 px-6 py-4 flex items-center justify-between rounded-2xl shadow-md bg-white/80 dark:bg-slate-800/80 sticky top-4 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg overflow-hidden relative">
           <Activity size={24} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            CivilEstimator Pro
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Advanced Structural Analysis</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700/50">
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${structureType === 'beam' ? 'bg-white shadow-sm text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            onClick={() => setStructureType('beam')}
          >
            Beam
          </button>
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${structureType === 'frame' ? 'bg-white shadow-sm text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            onClick={() => setStructureType('frame')}
          >
            Frame
          </button>
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${structureType === 'truss' ? 'bg-white shadow-sm text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            onClick={() => setStructureType('truss')}
          >
            Truss
          </button>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>

        <select 
          className="select-field w-40 flex items-center gap-2"
          onChange={handleExampleChange}
          defaultValue=""
        >
          <option value="" disabled>Load Example</option>
          <option value="continuous_beam">Continuous Beam</option>
          <option value="simple_beam">Simple Beam</option>
          <option value="cantilever">Cantilever</option>
          <option value="portal_frame">Portal Frame</option>
          <option value="simple_truss">Simple Truss</option>
          <option value="warren_truss">Warren Truss</option>
        </select>

        <select 
          className="select-field w-24"
          value={unitSystem}
          onChange={(e) => setUnitSystem(e.target.value)}
        >
          <option value="US">US Customary</option>
          <option value="SI">SI Metric</option>
        </select>

        <div className="flex gap-2">
          <button 
            className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            onClick={clearAll}
            title="Clear Diagram"
          >
            <RefreshCw size={18} />
          </button>
          <button 
            className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            onClick={toggleTheme}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

          <button 
            className="p-2.5 rounded-xl text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
            onClick={toggleAIAssistant}
            title="Ask AI Diagram Assistant"
          >
            <Sparkles size={18} />
            <span className="text-sm font-semibold hidden md:inline">Ask AI</span>
          </button>
        </div>

        <button 
          className="btn-gradient flex items-center gap-2 px-6 shadow-md shadow-blue-500/20"
          onClick={runAnalysis}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <div className="spinner w-5 h-5 border-2 border-white/30 border-t-white"></div>
          ) : (
            <>
              <Play size={18} fill="currentColor" />
              <span>Analyze</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
