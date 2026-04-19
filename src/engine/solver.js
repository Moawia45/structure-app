/**
 * Structural Analysis Solver
 * Solves for unknown deformations, reactions, and element forces
 * Uses math.js for matrix operations
 */

import { multiply, inv, transpose, det, zeros, matrix, subset, index } from 'mathjs';
import {
  buildDOFNumbering,
  assembleGlobalK,
  partitionMatrix,
  prepareElements,
  getElementDOFs
} from './assembler.js';
import { computeAllFEFs } from './fixedEndForces.js';
import { getElementStiffnessMatrix } from './stiffnessMatrix.js';
import { generateDiagramData } from './diagramData.js';
import { validateResults } from './validation.js';

/**
 * Main solver function — runs the complete Direct Stiffness Method
 * @param {Object} structureData - Complete structure input
 * @returns {Object} Complete analysis results with intermediate steps
 */
export function solve(structureData) {
  const { nodes, elements: rawElements, loads, analysisType } = structureData;

  const steps = {};

  // ============ STEP 1: Prepare Elements ============
  const elements = prepareElements(rawElements, nodes);
  steps.elements = elements.map(el => ({
    id: el.id,
    i: el.i,
    j: el.j,
    length: el.length,
    angle_deg: (el.angle_rad * 180) / Math.PI,
    E: el.E,
    I: el.I,
    A: el.A
  }));

  // ============ STEP 2: Fixed End Forces ============
  const { elementFEFs, nodeFEFs, equivalentLoads } = computeAllFEFs(elements, loads);
  steps.fixedEndForces = elementFEFs;
  steps.nodeFEFs = nodeFEFs;
  steps.equivalentLoads = equivalentLoads;

  // ============ STEP 3: DOF Numbering ============
  const dofInfo = buildDOFNumbering(nodes, analysisType);
  steps.dofNumbering = {
    dofMap: dofInfo.dofMap,
    freeDOFs: dofInfo.freeDOFs,
    restrainedDOFs: dofInfo.restrainedDOFs,
    totalDOFs: dofInfo.totalDOFs,
    numFree: dofInfo.numFree,
    numRestrained: dofInfo.numRestrained
  };

  // ============ STEP 4: Element Stiffness Matrices ============
  const { K_global, elementStiffnesses } = assembleGlobalK(
    elements, dofInfo.dofMap, dofInfo.totalDOFs, analysisType
  );
  steps.elementStiffnessMatrices = elementStiffnesses;
  steps.globalStiffnessMatrix = K_global;

  // ============ STEP 5: Partition Global Matrix ============
  const { K11, K12, K21, K22 } = partitionMatrix(
    K_global, dofInfo.numFree, dofInfo.totalDOFs
  );
  steps.K11 = K11;
  steps.K12 = K12;
  steps.K21 = K21;
  steps.K22 = K22;

  // ============ STEP 6: Build Load Vector ============
  const W_known = buildLoadVector(
    dofInfo, equivalentLoads, loads, nodes, analysisType
  );
  steps.loadVector = W_known;

  // ============ STEP 7: Solve for Deformations ============
  if (dofInfo.numFree === 0) {
    // All DOFs restrained — no unknowns to solve
    return buildResults(
      nodes, elements, loads, dofInfo,
      [], K21, elementFEFs, elementStiffnesses,
      analysisType, steps
    );
  }

  // Check if K11 is invertible
  const K11_mat = matrix(K11);
  const determinant = det(K11_mat);

  if (Math.abs(determinant) < 1e-10) {
    throw new Error(
      'Structure is unstable or mechanism detected! ' +
      'Global stiffness matrix K₁₁ is singular (determinant ≈ 0). ' +
      'Check support conditions and element connectivity.'
    );
  }

  // Δ_u = K11⁻¹ × W_known
  const K11_inv = inv(K11_mat);
  const W_vec = matrix(W_known);
  const delta_u = multiply(K11_inv, W_vec).toArray();
  steps.deformations_u = delta_u;
  steps.K11_inv = K11_inv.toArray();

  // ============ STEP 8: Solve for Reactions ============
  // W_u = K21 × Δ_u  (+ K22 × Δ_k, but Δ_k = 0)
  let reactions_vec = [];
  if (dofInfo.numRestrained > 0) {
    const K21_mat = matrix(K21);
    const delta_mat = matrix(delta_u);
    reactions_vec = multiply(K21_mat, delta_mat).toArray();
  }
  steps.reactions_raw = reactions_vec;

  // ============ STEP 9: Element Forces ============
  return buildResults(
    nodes, elements, loads, dofInfo,
    delta_u, reactions_vec, elementFEFs, elementStiffnesses,
    analysisType, steps
  );
}

/**
 * Build the known load vector [W_k] for free DOFs
 */
function buildLoadVector(dofInfo, equivalentLoads, loads, nodes, analysisType) {
  const W = new Array(dofInfo.numFree).fill(0);

  // Add equivalent joint loads (from FEFs) at free DOFs
  Object.keys(equivalentLoads).forEach(nodeIdStr => {
    const nodeId = parseInt(nodeIdStr);
    const eqLoad = equivalentLoads[nodeId];

    // Map to DOFs
    const thetaDof = dofInfo.dofMap[`${nodeId}_theta`];
    const uDof = dofInfo.dofMap[`${nodeId}_u`];
    const vDof = dofInfo.dofMap[`${nodeId}_v`];

    if (thetaDof !== undefined && thetaDof < dofInfo.numFree) {
      W[thetaDof] += eqLoad.M || 0;
    }
    if (vDof !== undefined && vDof < dofInfo.numFree) {
      W[vDof] += eqLoad.V || 0;
    }
    if (uDof !== undefined && uDof < dofInfo.numFree) {
      W[uDof] += eqLoad.H || 0;
    }
  });

  // Add directly applied nodal loads
  loads.forEach(load => {
    if (load.node_id !== undefined && !load.element_id) {
      const nodeId = load.node_id;

      if (load.type === 'point_load') {
        const dir = load.direction || 'down';
        if (dir === 'down' || dir === 'up') {
          const vDof = dofInfo.dofMap[`${nodeId}_v`];
          if (vDof !== undefined && vDof < dofInfo.numFree) {
            W[vDof] += dir === 'down' ? -load.magnitude : load.magnitude;
          }
        }
        if (dir === 'left' || dir === 'right') {
          const uDof = dofInfo.dofMap[`${nodeId}_u`];
          if (uDof !== undefined && uDof < dofInfo.numFree) {
            W[uDof] += dir === 'right' ? load.magnitude : -load.magnitude;
          }
        }
      }

      if (load.type === 'moment') {
        const thetaDof = dofInfo.dofMap[`${nodeId}_theta`];
        if (thetaDof !== undefined && thetaDof < dofInfo.numFree) {
          W[thetaDof] += load.magnitude;
        }
      }
    }
  });

  return W;
}

/**
 * Build complete results object
 */
function buildResults(
  nodes, elements, loads, dofInfo,
  delta_u, reactions_vec, elementFEFs, elementStiffnesses,
  analysisType, steps
) {
  // Full deformation vector
  const fullDelta = new Array(dofInfo.totalDOFs).fill(0);
  delta_u.forEach((val, i) => {
    fullDelta[i] = val;
  });

  // Build deformation results per node
  const deformations = nodes.map(node => {
    const result = { node_id: node.id };

    const thetaIdx = dofInfo.dofMap[`${node.id}_theta`];
    const uIdx = dofInfo.dofMap[`${node.id}_u`];
    const vIdx = dofInfo.dofMap[`${node.id}_v`];

    if (thetaIdx !== undefined) result.theta = fullDelta[thetaIdx];
    if (uIdx !== undefined) result.u = fullDelta[uIdx];
    if (vIdx !== undefined) result.v = fullDelta[vIdx];

    return result;
  });

  // Build reaction results
  const reactions = [];
  dofInfo.restrainedDOFsInfo.forEach((dof, i) => {
    let existingReaction = reactions.find(r => r.node_id === dof.nodeId);
    if (!existingReaction) {
      existingReaction = { node_id: dof.nodeId, Rx: 0, Ry: 0, M: 0 };
      reactions.push(existingReaction);
    }

    const reactionValue = reactions_vec[i] || 0;

    // Add back the fixed-end forces at supports
    const nodeFEF = steps.nodeFEFs[dof.nodeId] || { M: 0, V: 0, H: 0 };

    switch (dof.label) {
      case 'theta':
        existingReaction.M = reactionValue + nodeFEF.M;
        break;
      case 'u':
        existingReaction.Rx = reactionValue + nodeFEF.H;
        break;
      case 'v':
        existingReaction.Ry = reactionValue + nodeFEF.V;
        break;
    }
  });

  // Build element forces
  const elementForces = elements.map(el => {
    const dofs = getElementDOFs(el, dofInfo.dofMap, analysisType);
    const elDelta = dofs.map(d => fullDelta[d] || 0);

    // w_E = kT × Δ
    const { matrix: ke } = getElementStiffnessMatrix(el, analysisType);
    const w_E = ke.map((row, r) =>
      row.reduce((sum, val, c) => sum + val * elDelta[c], 0)
    );

    // Get fixed end forces for this element
    const fef = elementFEFs[el.id] || { Mi: 0, Mj: 0, Vi: 0, Vj: 0 };

    // Build result based on analysis type
    const result = { element_id: el.id, near: {}, far: {} };

    switch (analysisType) {
      case 'moment_only':
        result.near.M = w_E[0] + fef.Mi;
        result.far.M = w_E[1] + fef.Mj;
        break;

      case 'shear_moment':
        result.near.M = w_E[0] + fef.Mi;
        result.far.M = w_E[1] + fef.Mj;
        result.near.V = w_E[2] + fef.Vi;
        result.far.V = w_E[3] + fef.Vj;
        break;

      case 'full_frame':
        result.near.M = w_E[0] + fef.Mi;
        result.far.M = w_E[1] + fef.Mj;
        result.near.V = w_E[2] + fef.Vi;
        result.far.V = w_E[3] + fef.Vj;
        result.near.N = w_E[4] || 0;
        result.far.N = w_E[5] || 0;
        break;

      case 'truss':
        // For truss: compute axial force from global displacements
        const l = el.l;
        const m = el.m;
        const AE_L = (el.A * el.E) / el.length;
        const axialForce = AE_L * (
          -l * elDelta[0] - m * elDelta[1] + l * elDelta[2] + m * elDelta[3]
        );
        result.near.N = -axialForce;
        result.far.N = axialForce;
        result.near.M = 0;
        result.far.M = 0;
        result.near.V = 0;
        result.far.V = 0;
        break;
    }

    result.w_E = w_E;
    result.fef = fef;

    return result;
  });

  // Generate diagram data
  const diagramData = generateDiagramData(elements, elementForces, loads, analysisType);

  // Validate
  const validation = validateResults(nodes, elements, loads, reactions, analysisType);

  return {
    deformations,
    reactions,
    elementForces,
    diagramData,
    validation,
    intermediateSteps: steps
  };
}
