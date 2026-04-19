import React from 'react';
import useStructureStore from '../store/useStructureStore';
import { LayoutList, Download, ArrowRight, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ResultsPanel = () => {
  const { results, hasResults, units, activeTab, setActiveTab } = useStructureStore();

  if (!hasResults || !results || activeTab !== 'results') {
    return null;
  }

  const { deformations = [], reactions = [], elementForces = [] } = results;
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(30, 64, 175); // Blue-800
      pdf.text("Structural Analysis Report", pageWidth / 2, 20, { align: "center" });
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 116, 139); // Slate-500
      pdf.text("Created by Moawia Husnain", pageWidth / 2, 28, { align: "center" });
      
      pdf.setDrawColor(226, 232, 240); // Slate-200
      pdf.line(20, 35, pageWidth - 20, 35);

      // Try to capture Canvas
      const canvasEl = document.querySelector('.konvajs-content canvas');
      let currentY = 45;
      
      if (canvasEl) {
        const canvasDataUrl = canvasEl.toDataURL('image/png');
        // Scale to fit width
        const imgProps = pdf.getImageProperties(canvasDataUrl);
        const pdfWidth = pageWidth - 40;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Structure & Load Diagram", 20, currentY);
        currentY += 10;
        
        pdf.addImage(canvasDataUrl, 'PNG', 20, currentY, pdfWidth, pdfHeight);
        currentY += pdfHeight + 15;
      }

      // We'll capture the tables directly from DOM
      const tablesArea = document.getElementById('results-tables-area');
      if (tablesArea) {
        // We might run out of page space, add new page if needed
        if (currentY > 200) {
          pdf.addPage();
          currentY = 20;
        }
        
        // Hide scrollbars for capture
        tablesArea.style.overflow = 'visible';
        const canvas = await html2canvas(tablesArea, { scale: 2, backgroundColor: '#ffffff' });
        tablesArea.style.overflow = 'auto'; // restore
        
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pageWidth - 40;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 20, currentY, pdfWidth, pdfHeight);
      }
      
      pdf.save("Structural_Analysis_Report.pdf");
      
    } catch (e) {
      console.error("PDF Export failed", e);
      alert("Failed to export PDF: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl z-40 p-8 overflow-y-auto animate-fade-in flex flex-col gap-6 rounded-2xl m-4 ml-0 shadow-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 flex items-center gap-3">
          <LayoutList /> Analysis Results
        </h2>
        <div className="flex gap-3">
          <button className="btn-gradient bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 shadow-none px-4 py-2 text-sm flex items-center gap-2 rounded-lg" onClick={() => setActiveTab('input')}>
             <ArrowRight size={16} /> Back to Model
          </button>
          <button 
            className="btn-gradient px-4 py-2 text-sm flex items-center gap-2 rounded-lg disabled:opacity-50"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
             {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
             {isExporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>

      <div id="results-tables-area" className="flex flex-col gap-6 p-4 -m-4 bg-white dark:bg-slate-900 rounded-xl">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Joint Displacements</h3>
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Ux ({units.length})</th>
                  <th>Uy ({units.length})</th>
                  <th>Rz (rad)</th>
                </tr>
              </thead>
              <tbody>
                {deformations.map(d => (
                  <tr key={d.node_id}>
                    <td className="font-mono">{d.node_id}</td>
                    <td className="font-mono text-xs">{d.u !== undefined ? d.u.toExponential(4) : "0.0000"}</td>
                    <td className="font-mono text-xs">{d.v !== undefined ? d.v.toExponential(4) : "0.0000"}</td>
                    <td className="font-mono text-xs">{d.theta !== undefined ? d.theta.toExponential(4) : "0.0000"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Support Reactions</h3>
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Fx ({units.force})</th>
                  <th>Fy ({units.force})</th>
                  <th>Mz ({units.moment})</th>
                </tr>
              </thead>
              <tbody>
                {reactions.length === 0 && <tr><td colSpan="4" className="text-center text-slate-400 py-4 text-xs">No reactions computed</td></tr>}
                {reactions.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono">{r.node_id}</td>
                    <td className="font-mono text-xs text-blue-600 dark:text-blue-400">{r.Rx !== undefined ? r.Rx.toFixed(3) : "0.000"}</td>
                    <td className="font-mono text-xs text-blue-600 dark:text-blue-400">{r.Ry !== undefined ? r.Ry.toFixed(3) : "0.000"}</td>
                    <td className="font-mono text-xs text-purple-600 dark:text-purple-400">{r.M !== undefined ? r.M.toFixed(3) : "0.000"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Element Forces</h3>
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Element</th>
                <th>Axial (Start)</th>
                <th>Shear (Start)</th>
                <th>Moment (Start)</th>
                <th>Axial (End)</th>
                <th>Shear (End)</th>
                <th>Moment (End)</th>
              </tr>
            </thead>
            <tbody>
              {elementForces.map(er => {
                const N1 = er.near.N || 0;
                const V1 = er.near.V || 0;
                const M1 = er.near.M || 0;
                const N2 = er.far.N || 0;
                const V2 = er.far.V || 0;
                const M2 = er.far.M || 0;
                const forces = [N1, V1, M1, N2, V2, M2];
                const isFull = true;
                return (
                <tr key={er.element_id}>
                  <td className="font-mono font-bold">E{er.element_id}</td>
                  {isFull ? (
                    <>
                      <td className="font-mono text-xs">{forces[0].toFixed(3)}</td>
                      <td className="font-mono text-xs text-blue-600 dark:text-blue-400">{forces[1].toFixed(3)}</td>
                      <td className="font-mono text-xs text-purple-600 dark:text-purple-400">{forces[2].toFixed(3)}</td>
                      <td className="font-mono text-xs">{forces[3].toFixed(3)}</td>
                      <td className="font-mono text-xs text-blue-600 dark:text-blue-400">{forces[4].toFixed(3)}</td>
                      <td className="font-mono text-xs text-purple-600 dark:text-purple-400">{forces[5].toFixed(3)}</td>
                    </>
                  ) : (
                    <td colSpan="6" className="text-xs text-slate-500">Forces format depends on structure type.</td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ResultsPanel;
