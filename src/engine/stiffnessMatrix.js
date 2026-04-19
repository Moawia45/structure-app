/**
 * Element Stiffness Matrix Generator
 * Supports: Beam (moment-only), Beam (shear+moment), Plane Frame, Truss
 */

/**
 * Case I: Beam element — Bending Moment Only (2×2)
 * DOFs: [θ_i, θ_j]
 * Used when only rotational DOF exist at each node
 */
export function beamMomentOnly(E, I, L) {
  const EI = E * I;
  return [
    [4 * EI / L, 2 * EI / L],
    [2 * EI / L, 4 * EI / L]
  ];
}

/**
 * Case II: Beam element — Shear Force + Bending Moment (4×4)
 * DOFs: [θ_i, θ_j, v_i, v_j]
 * Used for continuous beams where vertical translation is also a DOF
 */
export function beamShearMoment(E, I, L) {
  const EI = E * I;
  const L2 = L * L;
  const L3 = L * L * L;
  return [
    [4 * EI / L,    2 * EI / L,    -6 * EI / L2,   6 * EI / L2],
    [2 * EI / L,    4 * EI / L,    -6 * EI / L2,   6 * EI / L2],
    [-6 * EI / L2, -6 * EI / L2,   12 * EI / L3, -12 * EI / L3],
    [6 * EI / L2,   6 * EI / L2,  -12 * EI / L3,  12 * EI / L3]
  ];
}

/**
 * Case III: Plane Frame element — Axial + Shear + Moment (6×6)
 * DOFs: [θ_i, θ_j, u_i, v_i, u_j, v_j]
 * Full frame element with direction cosines
 */
export function planeFrame(E, I, A, L, angle_rad) {
  const EI = E * I;
  const AE = A * E;
  const l = Math.cos(angle_rad); // direction cosine
  const m = Math.sin(angle_rad);
  const L2 = L * L;
  const L3 = L * L * L;

  return [
    // Row 0: θ_i
    [
      4 * EI / L,
      2 * EI / L,
      -6 * EI * m / L2,
      6 * EI * m / L2,
      6 * EI * l / L2,
      -6 * EI * l / L2
    ],
    // Row 1: θ_j
    [
      2 * EI / L,
      4 * EI / L,
      -6 * EI * m / L2,
      6 * EI * m / L2,
      6 * EI * l / L2,
      -6 * EI * l / L2
    ],
    // Row 2: u_i
    [
      -6 * EI * m / L2,
      -6 * EI * m / L2,
      12 * EI * m * m / L3 + AE * l * l / L,
      -(12 * EI * m * m / L3 - AE * l * l / L),
      -(12 * EI - AE) * l * m / (L * L2 / L),
      (12 * EI - AE) * l * m / (L * L2 / L)
    ],
    // Row 3: v_i (corrected formulation)
    [
      6 * EI * m / L2,
      6 * EI * m / L2,
      -(12 * EI * m * m / L3 - AE * l * l / L),
      12 * EI * m * m / L3 + AE * l * l / L,
      (12 * EI - AE) * l * m / (L * L2 / L),
      -(12 * EI - AE) * l * m / (L * L2 / L)
    ],
    // Row 4: u_j
    [
      6 * EI * l / L2,
      6 * EI * l / L2,
      -(12 * EI - AE) * l * m / (L * L2 / L),
      (12 * EI - AE) * l * m / (L * L2 / L),
      12 * EI * l * l / L3 + AE * m * m / L,
      -(12 * EI * l * l / L3 - AE * m * m / L)
    ],
    // Row 5: v_j
    [
      -6 * EI * l / L2,
      -6 * EI * l / L2,
      (12 * EI - AE) * l * m / (L * L2 / L),
      -(12 * EI - AE) * l * m / (L * L2 / L),
      -(12 * EI * l * l / L3 - AE * m * m / L),
      12 * EI * l * l / L3 + AE * m * m / L
    ]
  ];
}

/**
 * Case IV: Truss element — Axial Only (4×4 in global coordinates)
 * DOFs: [u_i, v_i, u_j, v_j]
 * Only axial forces — no bending or shear
 */
export function trussElement(E, A, L, angle_rad) {
  const l = Math.cos(angle_rad);
  const m = Math.sin(angle_rad);
  const k = (A * E) / L;

  return [
    [k * l * l,      k * l * m,     -k * l * l,     -k * l * m],
    [k * l * m,      k * m * m,     -k * l * m,     -k * m * m],
    [-k * l * l,    -k * l * m,      k * l * l,      k * l * m],
    [-k * l * m,    -k * m * m,      k * l * m,      k * m * m]
  ];
}

/**
 * Compute direction cosines and length from node coordinates
 */
export function computeElementGeometry(xi, yi, xj, yj) {
  const dx = xj - xi;
  const dy = yj - yi;
  const L = Math.sqrt(dx * dx + dy * dy);
  const angle_rad = Math.atan2(dy, dx);
  const l = dx / L; // cos(α)
  const m = dy / L; // sin(α)
  return { L, angle_rad, l, m };
}

/**
 * Get the appropriate stiffness matrix based on analysis type
 */
export function getElementStiffnessMatrix(element, analysisType) {
  const { E, I, A, length, angle_rad } = element;

  switch (analysisType) {
    case 'moment_only':
      return {
        matrix: beamMomentOnly(E, I, length),
        dofPerNode: 1,
        dofLabels: ['θ']
      };

    case 'shear_moment':
      return {
        matrix: beamShearMoment(E, I, length),
        dofPerNode: 2,
        dofLabels: ['θ', 'v']
      };

    case 'full_frame':
      return {
        matrix: planeFrame(E, I, A, length, angle_rad || 0),
        dofPerNode: 3,
        dofLabels: ['θ', 'u', 'v']
      };

    case 'truss':
      return {
        matrix: trussElement(E, A, length, angle_rad || 0),
        dofPerNode: 2,
        dofLabels: ['u', 'v']
      };

    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
  }
}
