import React, { useState } from 'react';
import useStructureStore from '../store/useStructureStore';
import { Plus, Trash2, Edit2, CheckCircle2 } from 'lucide-react';

const Sidebar = () => {
  const { 
    activeInputTab, 
    setActiveInputTab, 
    nodes, 
    elements, 
    loads, 
    addNode, 
    removeNode, 
    addElement, 
    removeElement,
    addLoad, 
    removeLoad,
    units
  } = useStructureStore();

  const [newNodeForm, setNewNodeForm] = useState({ x: '', y: '', support: 'free' });
  const [newElementForm, setNewElementForm] = useState({ i: '', j: '' });
  const [newLoadForm, setNewLoadForm] = useState({ 
    node_id: '', element_id: '', type: 'point_load', magnitude: '', direction: 'down', a: '0', b: '' 
  });

  const handleAddNode = (e) => {
    e.preventDefault();
    if (newNodeForm.x !== '' && newNodeForm.y !== '') {
      addNode({ x: parseFloat(newNodeForm.x), y: parseFloat(newNodeForm.y), support: newNodeForm.support });
      setNewNodeForm({ x: '', y: '', support: 'free' });
    }
  };

  const handleAddElement = (e) => {
    e.preventDefault();
    if (newElementForm.i && newElementForm.j && newElementForm.i !== newElementForm.j) {
      addElement({ i: parseInt(newElementForm.i), j: parseInt(newElementForm.j) });
      setNewElementForm({ i: '', j: '' });
    }
  };

  const handleAddLoad = (e) => {
    e.preventDefault();
    if (newLoadForm.magnitude !== '') {
      const loadObj = {
        type: newLoadForm.type,
        magnitude: parseFloat(newLoadForm.magnitude),
        direction: newLoadForm.direction
      };
      
      if (newLoadForm.type === 'point_load' || newLoadForm.type === 'moment') {
        if (newLoadForm.node_id) loadObj.node_id = parseInt(newLoadForm.node_id);
        else if (newLoadForm.element_id && newLoadForm.a !== '') {
          loadObj.element_id = parseInt(newLoadForm.element_id);
          loadObj.a = parseFloat(newLoadForm.a);
        }
      } else if (newLoadForm.type === 'UDL' && newLoadForm.element_id) {
        loadObj.element_id = parseInt(newLoadForm.element_id);
        if (newLoadForm.a !== '') loadObj.a = parseFloat(newLoadForm.a);
        if (newLoadForm.b !== '') loadObj.b = parseFloat(newLoadForm.b);
      }
      
      addLoad(loadObj);
    }
  };

  return (
    <aside className="w-96 glass-card rounded-2xl flex flex-col overflow-hidden h-[calc(100vh-8rem)] ml-4 shrink-0 bg-white/80 dark:bg-slate-800/80">
      <div className="flex border-b border-slate-200 dark:border-slate-700/50">
        <button 
          className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${activeInputTab === 'nodes' ? 'text-blue-600 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-800 dark:text-slate-400'}`}
          onClick={() => setActiveInputTab('nodes')}
        >
          Nodes <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">{nodes.length}</span>
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${activeInputTab === 'elements' ? 'text-blue-600 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-800 dark:text-slate-400'}`}
          onClick={() => setActiveInputTab('elements')}
        >
          Members <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">{elements.length}</span>
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${activeInputTab === 'loads' ? 'text-blue-600 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-800 dark:text-slate-400'}`}
          onClick={() => setActiveInputTab('loads')}
        >
          Loads <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">{loads.length}</span>
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {activeInputTab === 'nodes' && (
          <div className="space-y-6">
            <form onSubmit={handleAddNode} className="animate-fade-in p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Plus size={16}/> Add Node</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">X Position ({units.length})</label>
                  <input type="number" step="any" className="input-field" value={newNodeForm.x} onChange={e => setNewNodeForm({...newNodeForm, x: e.target.value})} placeholder="0.0" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Y Position ({units.length})</label>
                  <input type="number" step="any" className="input-field" value={newNodeForm.y} onChange={e => setNewNodeForm({...newNodeForm, y: e.target.value})} placeholder="0.0" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Support Condition</label>
                <select className="select-field" value={newNodeForm.support} onChange={e => setNewNodeForm({...newNodeForm, support: e.target.value})}>
                  <option value="free">Free / None</option>
                  <option value="pin">Pinned</option>
                  <option value="roller">Roller (Vert)</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <button type="submit" className="w-full btn-gradient py-2 flex justify-center mt-2 shadow-sm">Add Node</button>
            </form>

            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>X</th>
                    <th>Y</th>
                    <th>Support</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.length === 0 && <tr><td colSpan="5" className="text-center text-slate-400 py-4">No nodes defined</td></tr>}
                  {nodes.map(n => (
                    <tr key={n.id}>
                      <td className="font-mono text-xs">{n.id}</td>
                      <td>{n.x}</td>
                      <td>{n.y}</td>
                      <td>
                        <span className={`badge ${n.support === 'free' ? 'bg-slate-100 text-slate-500 dark:bg-slate-700' : 'badge-amber'}`}>
                          {n.support}
                        </span>
                      </td>
                      <td className="text-right">
                        <button onClick={() => removeNode(n.id)} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Similar tabs for Elements and Loads */}
        {activeInputTab === 'elements' && (
          <div className="space-y-6">
            <form onSubmit={handleAddElement} className="animate-fade-in p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Plus size={16}/> Connect Nodes</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Node i (Start)</label>
                  <select className="select-field" value={newElementForm.i} onChange={e => setNewElementForm({...newElementForm, i: e.target.value})} required>
                    <option value="" disabled>Select</option>
                    {nodes.map(n => <option key={n.id} value={n.id}>Node {n.id}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Node j (End)</label>
                  <select className="select-field" value={newElementForm.j} onChange={e => setNewElementForm({...newElementForm, j: e.target.value})} required>
                    <option value="" disabled>Select</option>
                    {nodes.map(n => <option key={n.id} value={n.id}>Node {n.id}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full btn-gradient py-2 flex justify-center mt-2 shadow-sm">Add Element</button>
            </form>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nodes</th>
                    <th>Props</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {elements.length === 0 && <tr><td colSpan="4" className="text-center text-slate-400 py-4">No elements defined</td></tr>}
                  {elements.map(e => (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{e.id}</td>
                      <td>{e.i} → {e.j}</td>
                      <td className="text-xs truncate max-w-[80px]">Default</td>
                      <td className="text-right">
                        <button onClick={() => removeElement(e.id)} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeInputTab === 'loads' && (
          <div className="space-y-6">
            <form onSubmit={handleAddLoad} className="animate-fade-in p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Plus size={16}/> Apply Load</h3>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Load Type</label>
                <select className="select-field" value={newLoadForm.type} onChange={e => setNewLoadForm({...newLoadForm, type: e.target.value})}>
                  <option value="point_load">Point Load</option>
                  <option value="UDL">Uniformly Distributed (UDL)</option>
                  <option value="moment">Moment</option>
                </select>
              </div>

              {newLoadForm.type === 'point_load' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Assign To</label>
                    <select className="select-field" value={newLoadForm.node_id ? 'node' : (newLoadForm.element_id ? 'elem' : '')} onChange={(e) => {
                      setNewLoadForm({...newLoadForm, node_id: '', element_id: ''});
                    }}>
                      <option value="" disabled>Choose target</option>
                      <option value="node">Node</option>
                      <option value="elem">Element</option>
                    </select>
                  </div>
                  {newLoadForm.node_id !== undefined && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Select Entity</label>
                      <input type="number" className="input-field" placeholder="ID" onChange={e => setNewLoadForm({...newLoadForm, node_id: e.target.value})} />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Mag ({units.force})</label>
                  <input type="number" step="any" className="input-field" value={newLoadForm.magnitude} onChange={e => setNewLoadForm({...newLoadForm, magnitude: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Direction</label>
                  <select className="select-field" value={newLoadForm.direction} onChange={e => setNewLoadForm({...newLoadForm, direction: e.target.value})}>
                    <option value="down">↓ Down (Gravity)</option>
                    <option value="up">↑ Up</option>
                    <option value="right">→ Right</option>
                    <option value="left">← Left</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full btn-gradient py-2 flex justify-center mt-2 shadow-sm">Add Load</button>
            </form>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Target</th>
                    <th>Mag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loads.length === 0 && <tr><td colSpan="4" className="text-center text-slate-400 py-4">No loads defined</td></tr>}
                  {loads.map(l => (
                    <tr key={l.id}>
                      <td className="text-xs font-medium"><span className="badge badge-red">{l.type.replace('_', ' ')}</span></td>
                      <td className="text-xs">{l.node_id ? `N${l.node_id}` : `E${l.element_id}`}</td>
                      <td className="text-xs font-mono">{l.magnitude}</td>
                      <td className="text-right">
                        <button onClick={() => removeLoad(l.id)} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
