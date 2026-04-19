/**
 * SFD & BMD Data Point Generator
 * Produces arrays of {x, value} points for D3.js rendering
 */

/**
 * Generate SFD and BMD data for all elements
 */
export function generateDiagramData(elements, elementForces, loads, analysisType) {
  const sfdData = [];
  const bmdData = [];
  const axialData = [];

  let cumulativeLength = 0;

  elements.forEach((el) => {
    const ef = elementForces.find(f => f.element_id === el.id);
    if (!ef) return;

    const L = el.length;
    const elLoads = loads.filter(l => l.element_id === el.id);

    // Generate points along the element
    const numPoints = 50;
    const dx = L / numPoints;

    // Determine loading on this element
    let hasUDL = false;
    let udlW = 0;
    let hasTriangular = false;
    let triW = 0;

    elLoads.forEach(load => {
      if (load.type === 'UDL') {
        hasUDL = true;
        udlW = Math.abs(load.magnitude);
      }
      if (load.type === 'triangular_load') {
        hasTriangular = true;
        triW = Math.abs(load.magnitude);
      }
    });

    // Get end forces
    const Vi = ef.near.V || 0;
    const Vj = ef.far.V || 0;
    const Mi = ef.near.M || 0;
    const Mj = ef.far.M || 0;
    const Ni = ef.near.N || 0;
    const Nj = ef.far.N || 0;

    // Point loads on this element (for discontinuities in SFD)
    const pointLoads = elLoads
      .filter(l => l.type === 'point_load')
      .map(l => ({
        position: l.a !== undefined ? l.a : L / 2,
        magnitude: Math.abs(l.magnitude)
      }))
      .sort((a, b) => a.position - b.position);

    const udlLoads = elLoads
      .filter(l => l.type === 'UDL')
      .map(l => ({
        w: Math.abs(l.magnitude),
        a: l.a !== undefined ? l.a : 0,
        b: l.b !== undefined ? l.b : L
      }));

    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      const globalX = cumulativeLength + x;

      let V, M;

      if (analysisType === 'truss') {
        V = 0;
        M = 0;
        const N = Ni + (Nj - Ni) * (x / L);
        axialData.push({ x: globalX, value: N, elementId: el.id, localX: x });
      } else {
        // Base from near-end interactions
        V = -Vi;
        M = Mi + (-Vi) * x;

        // Point load shear/moment drops
        pointLoads.forEach(pl => {
          if (x >= pl.position) {
            V += pl.magnitude; 
            M -= pl.magnitude * (x - pl.position);
          }
        });

        // Partial & Full UDL shear/moment drops
        udlLoads.forEach(udl => {
          if (x > udl.a) {
            const span = Math.min(x, udl.b) - udl.a;
            const wTotal = udl.w * span;
            V -= wTotal;
            M -= wTotal * (x - (udl.a + span / 2));
          }
        });
      }

      sfdData.push({
        x: globalX,
        value: V,
        elementId: el.id,
        localX: x
      });

      bmdData.push({
        x: globalX,
        value: M,
        elementId: el.id,
        localX: x
      });

      if (analysisType !== 'truss') {
        const N = Ni + (Nj - Ni) * (x / L);
        axialData.push({ x: globalX, value: N, elementId: el.id, localX: x });
      }
    }

    cumulativeLength += L;
  });

  // Find critical values
  const sfdMax = Math.max(...sfdData.map(d => d.value));
  const sfdMin = Math.min(...sfdData.map(d => d.value));
  const bmdMax = Math.max(...bmdData.map(d => d.value));
  const bmdMin = Math.min(...bmdData.map(d => d.value));

  // Find zero crossings in SFD (max moment locations)
  const zeroCrossings = [];
  for (let i = 1; i < sfdData.length; i++) {
    if (sfdData[i - 1].value * sfdData[i].value < 0) {
      // Linear interpolation for exact zero crossing
      const x1 = sfdData[i - 1].x;
      const x2 = sfdData[i].x;
      const v1 = sfdData[i - 1].value;
      const v2 = sfdData[i].value;
      const xZero = x1 - v1 * (x2 - x1) / (v2 - v1);

      // Find moment at this point (interpolate)
      const frac = (xZero - x1) / (x2 - x1);
      const mAtZero = bmdData[i - 1].value + frac * (bmdData[i].value - bmdData[i - 1].value);

      zeroCrossings.push({ x: xZero, moment: mAtZero });
    }
  }

  return {
    sfd: sfdData,
    bmd: bmdData,
    axial: axialData,
    totalLength: cumulativeLength,
    criticalValues: {
      sfd: { max: sfdMax, min: sfdMin },
      bmd: { max: bmdMax, min: bmdMin },
      zeroCrossings
    },
    nodePositions: computeNodePositions(elements)
  };
}

/**
 * Compute cumulative node positions for diagram annotation
 */
function computeNodePositions(elements) {
  const positions = [];
  let x = 0;

  if (elements.length > 0) {
    positions.push({ nodeId: elements[0].i, x: 0 });
  }

  elements.forEach(el => {
    x += el.length;
    positions.push({ nodeId: el.j, x });
  });

  return positions;
}
