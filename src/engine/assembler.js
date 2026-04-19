/**
 * Global Stiffness Matrix Assembler
 * Handles DOF numbering, assembly, and partitioning
 */

import { getElementStiffnessMatrix, computeElementGeometry } from './stiffnessMatrix.js';

/**
 * Determine restrained DOFs for a support type
 */
function getRestrainedDOFs(support, analysisType) {
  switch (analysisType) {
    case 'moment_only':
      // Only rotation DOF — fixed support restrains rotation
      if (support === 'fixed') return ['theta'];
      return []; // pin/roller/free don't restrain rotation in moment-only

    case 'shear_moment':
      // DOFs: rotation θ, vertical v
      switch (support) {
        case 'fixed': return ['theta', 'v'];
        case 'pin': return ['v'];
        case 'roller': return ['v'];
        case 'free': return [];
        default: return [];
      }

    case 'full_frame':
      // DOFs: rotation θ, horizontal u, vertical v
      switch (support) {
        case 'fixed': return ['theta', 'u', 'v'];
        case 'pin': return ['u', 'v'];
        case 'roller_h': return ['v']; // roller on horizontal surface
        case 'roller': return ['v'];
        case 'roller_v': return ['u']; // roller on vertical surface
        case 'free': return [];
        default: return [];
      }

    case 'truss':
      // DOFs: horizontal u, vertical v
      switch (support) {
        case 'fixed': return ['u', 'v'];
        case 'pin': return ['u', 'v'];
        case 'roller': return ['v'];
        case 'roller_h': return ['v'];
        case 'roller_v': return ['u'];
        case 'free': return [];
        default: return [];
      }

    default:
      return [];
  }
}

/**
 * Build DOF numbering for the structure
 * Free DOFs first, then restrained DOFs
 * @returns {{ dofMap: Object, freeDOFs: Array, restrainedDOFs: Array, totalDOFs: number }}
 */
export function buildDOFNumbering(nodes, analysisType) {
  const dofLabelsMap = {
    'moment_only': ['theta'],
    'shear_moment': ['theta', 'v'],
    'full_frame': ['theta', 'u', 'v'],
    'truss': ['u', 'v']
  };

  const dofLabels = dofLabelsMap[analysisType];
  const freeDOFsList = [];
  const restrainedDOFsList = [];

  // For each node, determine which DOFs are free vs restrained
  nodes.forEach(node => {
    const restrained = getRestrainedDOFs(node.support, analysisType);
    dofLabels.forEach(label => {
      const dofInfo = { nodeId: node.id, label };
      if (restrained.includes(label)) {
        restrainedDOFsList.push(dofInfo);
      } else {
        freeDOFsList.push(dofInfo);
      }
    });
  });

  // Number: free DOFs first (0, 1, 2, ...), then restrained
  const dofMap = {}; // key: "nodeId_label", value: global DOF index
  let idx = 0;

  freeDOFsList.forEach(dof => {
    dofMap[`${dof.nodeId}_${dof.label}`] = idx++;
  });

  restrainedDOFsList.forEach(dof => {
    dofMap[`${dof.nodeId}_${dof.label}`] = idx++;
  });

  return {
    dofMap,
    freeDOFs: freeDOFsList.map(d => dofMap[`${d.nodeId}_${d.label}`]),
    restrainedDOFs: restrainedDOFsList.map(d => dofMap[`${d.nodeId}_${d.label}`]),
    totalDOFs: idx,
    numFree: freeDOFsList.length,
    numRestrained: restrainedDOFsList.length,
    freeDOFsInfo: freeDOFsList,
    restrainedDOFsInfo: restrainedDOFsList,
    dofLabels
  };
}

/**
 * Get global DOF indices for an element
 */
export function getElementDOFs(element, dofMap, analysisType) {
  const dofLabelsMap = {
    'moment_only': ['theta'],
    'shear_moment': ['theta', 'v'],
    'full_frame': ['theta', 'u', 'v'],
    'truss': ['u', 'v']
  };

  const labels = dofLabelsMap[analysisType];
  const dofs = [];

  // Near end DOFs
  labels.forEach(label => {
    dofs.push(dofMap[`${element.i}_${label}`]);
  });

  // Far end DOFs
  labels.forEach(label => {
    dofs.push(dofMap[`${element.j}_${label}`]);
  });

  return dofs;
}

/**
 * Assemble global stiffness matrix
 * @param {Array} elements - Prepared elements with E, I, A, length, angle
 * @param {Object} dofMap - DOF numbering map
 * @param {number} totalDOFs - Total number of DOFs
 * @param {string} analysisType - Type of analysis
 * @returns {{ K_global: Array, elementStiffnesses: Array }}
 */
export function assembleGlobalK(elements, dofMap, totalDOFs, analysisType) {
  // Initialize global matrix with zeros
  const K = Array.from({ length: totalDOFs }, () =>
    Array.from({ length: totalDOFs }, () => 0)
  );

  const elementStiffnesses = [];

  elements.forEach(el => {
    // Get element stiffness matrix
    const { matrix: ke } = getElementStiffnessMatrix(el, analysisType);
    const dofs = getElementDOFs(el, dofMap, analysisType);

    elementStiffnesses.push({
      elementId: el.id,
      matrix: ke,
      dofs: dofs
    });

    // Assemble into global matrix
    const n = ke.length;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (dofs[r] !== undefined && dofs[c] !== undefined) {
          K[dofs[r]][dofs[c]] += ke[r][c];
        }
      }
    }
  });

  return { K_global: K, elementStiffnesses };
}

/**
 * Partition the global stiffness matrix
 * @returns {{ K11, K12, K21, K22 }}
 */
export function partitionMatrix(K, numFree, totalDOFs) {
  const nf = numFree;
  const nr = totalDOFs - numFree;

  const K11 = Array.from({ length: nf }, (_, i) =>
    Array.from({ length: nf }, (_, j) => K[i][j])
  );

  const K12 = Array.from({ length: nf }, (_, i) =>
    Array.from({ length: nr }, (_, j) => K[i][nf + j])
  );

  const K21 = Array.from({ length: nr }, (_, i) =>
    Array.from({ length: nf }, (_, j) => K[nf + i][j])
  );

  const K22 = Array.from({ length: nr }, (_, i) =>
    Array.from({ length: nr }, (_, j) => K[nf + i][nf + j])
  );

  return { K11, K12, K21, K22 };
}

/**
 * Prepare elements with computed geometry
 */
export function prepareElements(elements, nodes) {
  return elements.map(el => {
    const nodeI = nodes.find(n => n.id === el.i);
    const nodeJ = nodes.find(n => n.id === el.j);

    if (!nodeI || !nodeJ) {
      throw new Error(`Element ${el.id}: Node ${el.i} or ${el.j} not found`);
    }

    const geom = computeElementGeometry(nodeI.x, nodeI.y, nodeJ.x, nodeJ.y);

    return {
      ...el,
      length: geom.L,
      angle_rad: geom.angle_rad,
      l: geom.l,
      m: geom.m,
    };
  });
}
