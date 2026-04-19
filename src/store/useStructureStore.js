/**
 * Zustand Store — Central state management for the Structural Analysis App
 */
import { create } from 'zustand';
import { solve } from '../engine/solver.js';

const useStructureStore = create((set, get) => ({
  // ===== STRUCTURE DATA =====
  structureType: 'beam', // 'beam' | 'frame' | 'truss'
  analysisType: 'moment_only', // 'moment_only' | 'shear_moment' | 'full_frame' | 'truss'

  nodes: [],
  elements: [],
  loads: [],

  // ===== UNITS =====
  unitSystem: 'US', // 'US' | 'SI'
  units: {
    force: 'kips',
    length: 'ft',
    moment: 'kip·ft',
    stress: 'ksi',
    area: 'in²',
    inertia: 'in⁴',
  },

  // ===== DEFAULT PROPERTIES =====
  defaultE: 29000, // ksi
  defaultI: 100,   // in⁴
  defaultA: 10,    // in²

  // ===== UI STATE =====
  activeTab: 'input', // 'input' | 'canvas' | 'results' | 'export'
  activeInputTab: 'nodes',
  theme: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  isAnalyzing: false,
  error: null,
  canvasTool: 'select', // 'select' | 'node' | 'element' | 'load' | 'support' | 'delete'

  // ===== AI / GROQ =====
  isAIAssistantOpen: false,
  groqApiKey: '',

  // ===== RESULTS =====
  results: null,
  hasResults: false,
  showSFD: false,
  showBMD: false,

  // ===== HISTORY (undo/redo) =====
  history: [],
  historyIndex: -1,

  // ===== ACTIONS: Structure Type =====
  setStructureType: (type) => set((state) => {
    let analysisType;
    switch (type) {
      case 'beam': analysisType = 'moment_only'; break;
      case 'frame': analysisType = 'full_frame'; break;
      case 'truss': analysisType = 'truss'; break;
      default: analysisType = 'moment_only';
    }
    return { structureType: type, analysisType, results: null, hasResults: false, showSFD: false, showBMD: false };
  }),

  setAnalysisType: (type) => set({ analysisType: type, results: null, hasResults: false, showSFD: false, showBMD: false }),

  // ===== ACTIONS: Units =====
  setUnitSystem: (system) => set({
    unitSystem: system,
    units: system === 'US'
      ? { force: 'kips', length: 'ft', moment: 'kip·ft', stress: 'ksi', area: 'in²', inertia: 'in⁴' }
      : { force: 'kN', length: 'm', moment: 'kN·m', stress: 'MPa', area: 'cm²', inertia: 'cm⁴' },
    defaultE: system === 'US' ? 29000 : 200000,
    defaultI: system === 'US' ? 100 : 8333,
    defaultA: system === 'US' ? 10 : 64.5,
  }),

  // ===== ACTIONS: Nodes =====
  addNode: (node) => set((state) => {
    const id = state.nodes.length > 0 ? Math.max(...state.nodes.map(n => n.id)) + 1 : 1;
    const newNode = {
      id,
      x: node.x || 0,
      y: node.y || 0,
      support: node.support || 'free',
      ...node,
      id,
    };
    return {
      nodes: [...state.nodes, newNode],
      results: null,
      hasResults: false,
    };
  }),

  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
    results: null,
    hasResults: false,
  })),

  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter(n => n.id !== id),
    elements: state.elements.filter(e => e.i !== id && e.j !== id),
    loads: state.loads.filter(l => l.node_id !== id),
    results: null,
    hasResults: false,
  })),

  // ===== ACTIONS: Elements =====
  addElement: (element) => set((state) => {
    const id = state.elements.length > 0 ? Math.max(...state.elements.map(e => e.id)) + 1 : 1;
    const newElement = {
      id,
      i: element.i,
      j: element.j,
      E: element.E || state.defaultE,
      I: element.I || state.defaultI,
      A: element.A || state.defaultA,
    };
    return {
      elements: [...state.elements, newElement],
      results: null,
      hasResults: false,
    };
  }),

  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map(e => e.id === id ? { ...e, ...updates } : e),
    results: null,
    hasResults: false,
  })),

  removeElement: (id) => set((state) => ({
    elements: state.elements.filter(e => e.id !== id),
    loads: state.loads.filter(l => l.element_id !== id),
    results: null,
    hasResults: false,
  })),

  // ===== ACTIONS: Loads =====
  addLoad: (load) => set((state) => {
    const id = state.loads.length > 0 ? Math.max(...state.loads.map(l => l.id)) + 1 : 1;
    return {
      loads: [...state.loads, { id, ...load }],
      results: null,
      hasResults: false,
    };
  }),

  updateLoad: (id, updates) => set((state) => ({
    loads: state.loads.map(l => l.id === id ? { ...l, ...updates } : l),
    results: null,
    hasResults: false,
  })),

  removeLoad: (id) => set((state) => ({
    loads: state.loads.filter(l => l.id !== id),
    results: null,
    hasResults: false,
  })),

  // ===== ACTIONS: Analysis =====
  runAnalysis: () => {
    const state = get();

    if (state.nodes.length < 2) {
      set({ error: 'At least 2 nodes are required.' });
      return;
    }
    if (state.elements.length < 1) {
      set({ error: 'At least 1 element is required.' });
      return;
    }

    set({ isAnalyzing: true, error: null });

    try {
      const structureData = {
        nodes: state.nodes,
        elements: state.elements,
        loads: state.loads,
        analysisType: state.analysisType,
        structureType: state.structureType,
      };

      const results = solve(structureData);
      set({
        results,
        hasResults: true,
        showSFD: false,
        showBMD: false,
        isAnalyzing: false,
        activeTab: 'results',
        error: null,
      });
    } catch (err) {
      set({
        error: err.message || 'Analysis failed. Check your input data.',
        isAnalyzing: false,
      });
    }
  },

  // ===== ACTIONS: UI =====
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveInputTab: (tab) => set({ activeInputTab: tab }),
  setCanvasTool: (tool) => set({ canvasTool: tool }),
  toggleSFD: () => set(state => ({ showSFD: !state.showSFD })),
  toggleBMD: () => set(state => ({ showBMD: !state.showBMD })),

  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // ===== ACTIONS: AI ASSISTANT =====
  toggleAIAssistant: () => set((state) => ({ isAIAssistantOpen: !state.isAIAssistantOpen })),
  setGroqApiKey: (key) => set({ groqApiKey: key }),

  // ===== ACTIONS: Import / Clear =====
  importStructure: (data) => set({
    nodes: data.nodes || [],
    elements: data.elements || [],
    loads: data.loads || [],
    structureType: data.structureType || 'beam',
    analysisType: data.analysisType || 'moment_only',
    results: null,
    hasResults: false,
    error: null,
  }),

  clearAll: () => set({
    nodes: [],
    elements: [],
    loads: [],
    results: null,
    hasResults: false,
    error: null,
  }),

  // ===== ACTIONS: Load Example =====
  loadExample: (exampleName) => {
    const examples = getExamples();
    const example = examples[exampleName];
    if (example) {
      set({
        ...example,
        results: null,
        hasResults: false,
        error: null,
        activeTab: 'input',
      });
    }
  },
}));

/**
 * Built-in example structures for testing/tutorial
 */
function getExamples() {
  return {
    'continuous_beam': {
      structureType: 'beam',
      analysisType: 'moment_only',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'pin' },
        { id: 2, x: 10, y: 0, support: 'roller' },
        { id: 3, x: 25, y: 0, support: 'roller' },
        { id: 4, x: 37, y: 0, support: 'roller' },
      ],
      elements: [
        { id: 1, i: 1, j: 2, E: 29000, I: 100, A: 10 },
        { id: 2, i: 2, j: 3, E: 29000, I: 100, A: 10 },
        { id: 3, i: 3, j: 4, E: 29000, I: 100, A: 10 },
      ],
      loads: [
        { id: 1, element_id: 1, type: 'point_load', magnitude: 10, direction: 'down', a: 5 },
        { id: 2, element_id: 2, type: 'UDL', magnitude: 2, direction: 'down', a: 0, b: 15 },
        { id: 3, element_id: 3, type: 'point_load', magnitude: 10, direction: 'down', a: 6 },
      ],
    },

    'simple_beam': {
      structureType: 'beam',
      analysisType: 'shear_moment',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'pin' },
        { id: 2, x: 10, y: 0, support: 'roller' },
      ],
      elements: [
        { id: 1, i: 1, j: 2, E: 29000, I: 100, A: 10 },
      ],
      loads: [
        { id: 1, element_id: 1, type: 'point_load', magnitude: 20, direction: 'down', a: 5 },
      ],
    },

    'cantilever': {
      structureType: 'beam',
      analysisType: 'shear_moment',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'fixed' },
        { id: 2, x: 12, y: 0, support: 'free' },
      ],
      elements: [
        { id: 1, i: 1, j: 2, E: 29000, I: 100, A: 10 },
      ],
      loads: [
        { id: 1, element_id: 1, type: 'UDL', magnitude: 3, direction: 'down' },
      ],
    },

    'portal_frame': {
      structureType: 'frame',
      analysisType: 'full_frame',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'fixed' },
        { id: 2, x: 0, y: 12, support: 'free' },
        { id: 3, x: 20, y: 12, support: 'free' },
        { id: 4, x: 20, y: 0, support: 'fixed' },
      ],
      elements: [
        { id: 1, i: 1, j: 2, E: 29000, I: 200, A: 15 },
        { id: 2, i: 2, j: 3, E: 29000, I: 200, A: 15 },
        { id: 3, i: 3, j: 4, E: 29000, I: 200, A: 15 },
      ],
      loads: [
        { id: 1, element_id: 2, type: 'UDL', magnitude: 3, direction: 'down' },
        { id: 2, node_id: 2, type: 'point_load', magnitude: 10, direction: 'right' },
      ],
    },

    'simple_truss': {
      structureType: 'truss',
      analysisType: 'truss',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'pin' },
        { id: 2, x: 10, y: 0, support: 'roller' },
        { id: 3, x: 5, y: 8, support: 'free' },
      ],
      elements: [
        { id: 1, i: 1, j: 2, E: 29000, I: 0, A: 5 },
        { id: 2, i: 1, j: 3, E: 29000, I: 0, A: 5 },
        { id: 3, i: 2, j: 3, E: 29000, I: 0, A: 5 },
      ],
      loads: [
        { id: 1, node_id: 3, type: 'point_load', magnitude: 20, direction: 'down' },
      ],
    },

    'warren_truss': {
      structureType: 'truss',
      analysisType: 'truss',
      nodes: [
        { id: 1, x: 0, y: 0, support: 'pin' },
        { id: 2, x: 10, y: 0, support: 'free' },
        { id: 3, x: 20, y: 0, support: 'free' },
        { id: 4, x: 30, y: 0, support: 'roller' },
        { id: 5, x: 5, y: 8, support: 'free' },
        { id: 6, x: 15, y: 8, support: 'free' },
        { id: 7, x: 25, y: 8, support: 'free' },
      ],
      elements: [
        { id: 1, i: 1, j: 2, E: 29000, I: 0, A: 5 },
        { id: 2, i: 2, j: 3, E: 29000, I: 0, A: 5 },
        { id: 3, i: 3, j: 4, E: 29000, I: 0, A: 5 },
        { id: 4, i: 1, j: 5, E: 29000, I: 0, A: 5 },
        { id: 5, i: 5, j: 2, E: 29000, I: 0, A: 5 },
        { id: 6, i: 5, j: 6, E: 29000, I: 0, A: 5 },
        { id: 7, i: 2, j: 6, E: 29000, I: 0, A: 5 },
        { id: 8, i: 6, j: 3, E: 29000, I: 0, A: 5 },
        { id: 9, i: 6, j: 7, E: 29000, I: 0, A: 5 },
        { id: 10, i: 3, j: 7, E: 29000, I: 0, A: 5 },
        { id: 11, i: 7, j: 4, E: 29000, I: 0, A: 5 },
      ],
      loads: [
        { id: 1, node_id: 2, type: 'point_load', magnitude: 15, direction: 'down' },
        { id: 2, node_id: 3, type: 'point_load', magnitude: 15, direction: 'down' },
      ],
    },
  };
}

export default useStructureStore;
