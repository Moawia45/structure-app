import React, { useState, useRef, useEffect } from 'react';
import useStructureStore from '../store/useStructureStore';
import { askAboutDiagram, fileToBase64 } from '../api/groqService';
import { X, Send, Image as ImageIcon, FileText, Loader2, Key } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const AIAssistant = () => {
  const { isAIAssistantOpen, toggleAIAssistant, importStructure, setStructureType, setAnalysisType, clearAll, groqApiKey, setGroqApiKey, runAnalysis } = useStructureStore();
  const ENV_KEY = import.meta.env.VITE_GROQ_API_KEY;
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Upload an image or PDF of a structural diagram, and ask me any questions about it!' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageBase64, setSelectedImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isAIAssistantOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      let base64;
      if (file.type === 'application/pdf') {
        base64 = await convertPdfToBase64(file);
      } else if (file.type.startsWith('image/')) {
        base64 = await fileToBase64(file);
      } else {
        alert("Please upload a valid Image or PDF file.");
        setIsLoading(false);
        return;
      }
      
      setSelectedImageBase64(base64);
      setImagePreview(`data:image/jpeg;base64,${base64}`);
      
      // Auto-Trigger Extraction
      if (groqApiKey || ENV_KEY) {
        autoExtractDiagram(base64);
      }

    } catch (err) {
      console.error(err);
      alert("Error processing file: " + err.message);
      setIsLoading(false);
    } finally {
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const autoExtractDiagram = async (base64) => {
    setMessages(prev => [...prev, { role: 'ai', content: '*Scanning diagram and auto-calculating...*' }]);
    try {
      const activeKey = groqApiKey || ENV_KEY;
      const response = await askAboutDiagram(base64, "Please extract the full JSON structural parameters for this diagram accurately based on the dimensions written. Provide ONLY the JSON if possible.", activeKey);
      
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.nodes && parsed.elements) {
            clearAll();
            if (parsed.structureType) {
              setStructureType(parsed.structureType);
              if (parsed.structureType === 'truss') setAnalysisType('truss');
              else if (parsed.structureType === 'frame') setAnalysisType('full_frame');
              else setAnalysisType('moment_only');
            }
            importStructure(parsed);
            
            // Auto Trigger Analysis
            setTimeout(() => {
              const store = useStructureStore.getState();
              store.runAnalysis();
              
              setTimeout(() => {
                const updatedStore = useStructureStore.getState();
                if (updatedStore.hasResults) {
                  if (!updatedStore.showSFD) updatedStore.toggleSFD();
                  if (!updatedStore.showBMD) updatedStore.toggleBMD();
                }
              }, 200);

            }, 500);

            setMessages(prev => [
              ...prev.slice(0, -1), 
              { role: 'ai', content: "✅ **Diagram Auto-Imported & Analyzed!**\n\nThe diagram was successfully parsed and solved. SFD and BMD overlays are active on the Canvas.\n\n*Have any conceptual questions about this structure?*" }
            ]);
            setIsLoading(false);
            return;
        }
      }
      setMessages(prev => [...prev.slice(0, -1), { role: 'ai', content: "⚠️ I analyzed the image but couldn't parse the structure perfectly. You can still ask me manual questions about it!" }]);
    } catch (err) {
      setMessages(prev => [...prev.slice(0, -1), { role: 'ai', content: `Error: ${err.message}` }]);
    }
    setIsLoading(false);
  };

  const convertPdfToBase64 = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    
    // Get base64 string without data:image/jpeg;base64, prefix
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1];
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedImageBase64) return;
    if (!groqApiKey && !ENV_KEY) {
      alert("Please enter a Groq API Key first or add it to .env or Vercel.");
      return;
    }

    const currentMsg = inputMessage;
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: currentMsg }]);
    setIsLoading(true);

    try {
      const activeKey = groqApiKey || ENV_KEY;
      const response = await askAboutDiagram(selectedImageBase64, currentMsg, activeKey);
      
      // Parse out JSON if appended
      let cleanedResponse = response;
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.nodes && parsed.elements) {
             clearAll();
             if (parsed.structureType) {
               setStructureType(parsed.structureType);
               if (parsed.structureType === 'truss') setAnalysisType('truss');
               else if (parsed.structureType === 'frame') setAnalysisType('full_frame');
               else setAnalysisType('moment_only');
             }
             importStructure(parsed);
             cleanedResponse = response.replace(/```json\n[\s\S]*?\n```/, '').trim() + "\n\n*(I have automatically imported the diagram into the canvas!)*";
          }
        } catch (e) {
          console.error("Failed to parse appended structure data", e);
        }
      }

      setMessages(prev => [...prev, { role: 'ai', content: cleanedResponse }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 bottom-4 w-96 backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Loader2 className="animate-spin text-blue-500" size={18} style={{ display: isLoading ? 'block' : 'none' }} />
          {!isLoading && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
          Groq Vision AI
        </h3>
        <button onClick={toggleAIAssistant} className="text-slate-400 hover:text-red-500 transition-colors p-1">
          <X size={20} />
        </button>
      </div>

      {/* API Key Input Fallback */}
      {!ENV_KEY && !groqApiKey && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs border-b border-blue-100 dark:border-blue-800 flex flex-col gap-2">
          <p className="text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
            <Key size={14}/> Groq API Key Required
          </p>
          <input 
            type="password" 
            placeholder="gsk_..."
            className="input-field py-1 px-2 w-full text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setGroqApiKey(e.target.value);
              }
            }}
            onBlur={(e) => setGroqApiKey(e.target.value)}
          />
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20 flex flex-col items-center gap-2">
        {imagePreview ? (
          <div className="relative group w-full">
            <img src={imagePreview} alt="Diagram" className="max-h-32 w-full object-contain rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1" />
            <button 
              onClick={() => { setSelectedImageBase64(null); setImagePreview(null); }}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div 
            className="w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex gap-2 mb-1 text-blue-500">
              <ImageIcon size={20} />
              <FileText size={20} />
            </div>
            <span className="text-xs font-medium">Upload Image or PDF</span>
          </div>
        )}
        <input 
          type="file" 
          accept="image/*,application/pdf" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm prose prose-sm dark:prose-invert'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 pr-2 shadow-inner">
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-2 max-h-32 min-h-[40px] resize-none text-slate-800 dark:text-slate-200"
            placeholder={imagePreview ? "Ask about the diagram..." : "Upload a diagram first..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={!imagePreview || isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button 
            className={`p-2 rounded-lg mb-1 transition-colors ${inputMessage.trim() && imagePreview && !isLoading ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' : 'text-slate-400 bg-slate-200 dark:bg-slate-700'}`}
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || !imagePreview || isLoading}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
