import React, { useEffect, useState } from 'react'
import useStructureStore from './store/useStructureStore'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import CanvasArea from './components/CanvasArea'
import ResultsPanel from './components/ResultsPanel'
import AIAssistant from './components/AIAssistant'
import { AlertCircle } from 'lucide-react'
import './index.css'

function App() {
  const { theme, error, clearError } = useStructureStore();
  const [showAttribution, setShowAttribution] = useState(true);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className={`min-h-screen flex flex-col selection:bg-blue-500/30 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      {/* Background gradients for aesthetics */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 dark:bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 dark:bg-purple-600/10 blur-[120px]" />
      </div>

      <Navbar />
      
      <main className="flex-1 flex overflow-hidden relative">
        <Sidebar />
        
        <div className="flex-1 relative flex flex-col">
          <CanvasArea />
          <ResultsPanel />
          <AIAssistant />
          
          {/* Error Toast */}
          {error && (
            <div className="absolute bottom-6 mx-auto left-0 right-0 w-max max-w-md animate-slide-in z-50">
              <div className="glass-card bg-red-50/90 dark:bg-red-950/90 border-red-200 dark:border-red-800/50 p-4 rounded-xl flex items-start gap-3 shadow-lg shadow-red-500/10">
                <AlertCircle className="text-red-500 shrink-0" size={20} />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Analysis Error</h4>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
                </div>
                <button 
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

          {/* Attribution Pop-up */}
          {showAttribution && (
            <div className="absolute bottom-6 right-6 w-max max-w-sm animate-fade-in z-50">
              <div className="glass-card bg-white/90 dark:bg-slate-800/90 border-blue-200 dark:border-blue-800/50 p-4 rounded-xl flex gap-3 shadow-lg shadow-blue-500/10 border">
                <div className="flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Created by <strong>Moawia Husnain</strong><br/>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Civil Engineering Student, UET Taxila</span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowAttribution(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors h-fit text-xl leading-none"
                  title="Close"
                >
                  &times;
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
