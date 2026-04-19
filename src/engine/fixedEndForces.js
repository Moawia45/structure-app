/**
 * Fixed End Forces (FEF) / Fixed End Moments (FEM) Calculator
 * Computes FEM for various loading conditions on beam/frame elements
 */

/**
 * Point load at distance a from near end
 * @param {number} P - Load magnitude (positive = downward for gravity loads)
 * @param {number} a - Distance from near end
 * @param {number} L - Element length
 * @returns {{ Mi: number, Mj: number, Vi: number, Vj: number }}
 */
export function femPointLoad(P, a, L) {
  const b = L - a;
  const Mi = -(P * a * b * b) / (L * L);
  const Mj = (P * a * a * b) / (L * L);
  const Vi = -(P * b * b * (3 * a + b)) / (L * L * L);
  const Vj = -(P * a * a * (a + 3 * b)) / (L * L * L);
  return { Mi, Mj, Vi, Vj };
}

/**
 * Uniform Distributed Load (UDL) over full span
 * @param {number} w - Load intensity (force/length)
 * @param {number} L - Element length
 * @returns {{ Mi: number, Mj: number, Vi: number, Vj: number }}
 */
export function femUDL(w, L) {
  const Mi = -(w * L * L) / 12;
  const Mj = (w * L * L) / 12;
  const Vi = -(w * L) / 2;
  const Vj = -(w * L) / 2;
  return { Mi, Mj, Vi, Vj };
}

/**
 * Partial UDL from distance a to distance b from near end
 * Uses superposition of full UDL and correction
 */
export function femPartialUDL(w, a, b, L) {
  // Use numerical integration approach for general partial UDL
  const n = 100; // integration points
  const dx = (b - a) / n;
  let Mi = 0, Mj = 0, Vi = 0, Vj = 0;

  for (let i = 0; i <= n; i++) {
    const x = a + i * dx;
    const dP = w * dx;
    const contrib = femPointLoad(dP, x, L);
    Mi += contrib.Mi;
    Mj += contrib.Mj;
    Vi += contrib.Vi;
    Vj += contrib.Vj;
  }

  return { Mi, Mj, Vi, Vj };
}

/**
 * Triangular load: 0 at near end, w at far end
 * @param {number} w - Maximum load intensity at far end
 * @param {number} L - Element length
 * @returns {{ Mi: number, Mj: number, Vi: number, Vj: number }}
 */
export function femTriangularLoad(w, L) {
  const Mi = -(w * L * L) / 30;
  const Mj = (w * L * L) / 20;
  const Vi = -(3 * w * L) / 20;
  const Vj = -(7 * w * L) / 20;
  return { Mi, Mj, Vi, Vj };
}

/**
 * Triangular load: w at near end, 0 at far end
 */
export function femTriangularLoadReverse(w, L) {
  const Mi = -(w * L * L) / 20;
  const Mj = (w * L * L) / 30;
  const Vi = -(7 * w * L) / 20;
  const Vj = -(3 * w * L) / 20;
  return { Mi, Mj, Vi, Vj };
}

/**
 * Applied concentrated moment at distance a from near end
 * @param {number} M - Applied moment magnitude
 * @param {number} a - Distance from near end
 * @param {number} L - Element length
 * @returns {{ Mi: number, Mj: number, Vi: number, Vj: number }}
 */
export function femAppliedMoment(M, a, L) {
  const b = L - a;
  const Mi = -(M * b / L) * (3 * a / L - 1);
  const Mj = (M * a / L) * (3 * b / L - 1);
  const Vi = 6 * M * a * b / (L * L * L);
  const Vj = -6 * M * a * b / (L * L * L);
  return { Mi, Mj, Vi, Vj };
}

/**
 * Calculate fixed end forces for a given load on an element
 * @param {Object} load - Load object with type, magnitude, position info
 * @param {number} L - Element length
 * @returns {{ Mi: number, Mj: number, Vi: number, Vj: number }}
 */
export function calculateFEF(load, L) {
  switch (load.type) {
    case 'point_load': {
      const P = Math.abs(load.magnitude);
      const a = load.a || L / 2;
      return femPointLoad(P, a, L);
    }
    case 'UDL': {
      const w = Math.abs(load.magnitude);
      if (load.a !== undefined && load.b !== undefined && 
          (load.a > 0 || load.b < L)) {
        return femPartialUDL(w, load.a, load.b, L);
      }
      return femUDL(w, L);
    }
    case 'triangular_load': {
      const w = Math.abs(load.magnitude);
      if (load.direction_variant === 'reverse') {
        return femTriangularLoadReverse(w, L);
      }
      return femTriangularLoad(w, L);
    }
    case 'moment': {
      const M = load.magnitude;
      const a = load.a || L / 2;
      return femAppliedMoment(M, a, L);
    }
    default:
      return { Mi: 0, Mj: 0, Vi: 0, Vj: 0 };
  }
}

/**
 * Calculate net FEFs at each node and equivalent joint loads
 * @param {Array} elements - Array of element objects
 * @param {Array} loads - Array of load objects (with element_id references)
 * @returns {{ elementFEFs: Object, nodeFEFs: Object, equivalentLoads: Object }}
 */
export function computeAllFEFs(elements, loads) {
  // FEFs per element
  const elementFEFs = {};

  elements.forEach(el => {
    const elLoads = loads.filter(l => l.element_id === el.id);
    let totalMi = 0, totalMj = 0, totalVi = 0, totalVj = 0;

    elLoads.forEach(load => {
      const fef = calculateFEF(load, el.length);
      totalMi += fef.Mi;
      totalMj += fef.Mj;
      totalVi += fef.Vi;
      totalVj += fef.Vj;
    });

    elementFEFs[el.id] = {
      Mi: totalMi,
      Mj: totalMj,
      Vi: totalVi,
      Vj: totalVj
    };
  });

  // Net FEFs at each node (sum contributions from all connected elements)
  const nodeFEFs = {};

  elements.forEach(el => {
    const fef = elementFEFs[el.id];
    // Near end (i) contributes to node el.i
    if (!nodeFEFs[el.i]) nodeFEFs[el.i] = { M: 0, V: 0, H: 0 };
    nodeFEFs[el.i].M += fef.Mi;
    nodeFEFs[el.i].V += fef.Vi;

    // Far end (j) contributes to node el.j
    if (!nodeFEFs[el.j]) nodeFEFs[el.j] = { M: 0, V: 0, H: 0 };
    nodeFEFs[el.j].M += fef.Mj;
    nodeFEFs[el.j].V += fef.Vj;
  });

  // Equivalent joint loads = negative of net FEFs
  const equivalentLoads = {};
  Object.keys(nodeFEFs).forEach(nodeId => {
    equivalentLoads[nodeId] = {
      M: -nodeFEFs[nodeId].M,
      V: -nodeFEFs[nodeId].V,
      H: -nodeFEFs[nodeId].H,
    };
  });

  return { elementFEFs, nodeFEFs, equivalentLoads };
}
