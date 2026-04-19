/**
 * Result Validation — Equilibrium and Consistency Checks
 */

/**
 * Validate analysis results against equilibrium conditions
 */
export function validateResults(nodes, elements, loads, reactions, analysisType) {
  const checks = [];

  if (analysisType === 'truss' || analysisType === 'full_frame' || analysisType === 'shear_moment') {
    // Sum of applied vertical loads
    let totalAppliedVy = 0;
    loads.forEach(load => {
      if (load.type === 'point_load') {
        const dir = load.direction || 'down';
        if (dir === 'down') totalAppliedVy -= Math.abs(load.magnitude);
        if (dir === 'up') totalAppliedVy += Math.abs(load.magnitude);
      }
      if (load.type === 'UDL') {
        const el = elements.find(e => e.id === load.element_id);
        if (el) {
          const span = (load.b || el.length) - (load.a || 0);
          totalAppliedVy -= Math.abs(load.magnitude) * span;
        }
      }
      if (load.type === 'triangular_load') {
        const el = elements.find(e => e.id === load.element_id);
        if (el) {
          totalAppliedVy -= 0.5 * Math.abs(load.magnitude) * el.length;
        }
      }
    });

    // Sum of reaction forces
    let totalReactionVy = 0;
    let totalReactionVx = 0;
    reactions.forEach(r => {
      totalReactionVy += r.Ry || 0;
      totalReactionVx += r.Rx || 0;
    });

    const verticalError = Math.abs(totalAppliedVy + totalReactionVy);
    checks.push({
      name: 'Vertical Equilibrium (ΣFy = 0)',
      applied: totalAppliedVy,
      reactions: totalReactionVy,
      error: verticalError,
      passed: verticalError < 0.01,
      details: `Applied: ${totalAppliedVy.toFixed(4)}, Reactions: ${totalReactionVy.toFixed(4)}`
    });

    // Sum of applied horizontal loads
    let totalAppliedVx = 0;
    loads.forEach(load => {
      if (load.type === 'point_load') {
        const dir = load.direction || 'down';
        if (dir === 'right') totalAppliedVx += Math.abs(load.magnitude);
        if (dir === 'left') totalAppliedVx -= Math.abs(load.magnitude);
      }
    });

    const horizontalError = Math.abs(totalAppliedVx + totalReactionVx);
    checks.push({
      name: 'Horizontal Equilibrium (ΣFx = 0)',
      applied: totalAppliedVx,
      reactions: totalReactionVx,
      error: horizontalError,
      passed: horizontalError < 0.01,
      details: `Applied: ${totalAppliedVx.toFixed(4)}, Reactions: ${totalReactionVx.toFixed(4)}`
    });
  }

  const allPassed = checks.every(c => c.passed);

  return {
    checks,
    allPassed,
    summary: allPassed
      ? '✓ All equilibrium checks passed'
      : '⚠ Some equilibrium checks failed — review structure definition'
  };
}
