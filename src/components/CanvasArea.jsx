import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Circle, Line, Text, Group, RegularPolygon, Arrow } from 'react-konva';
import useStructureStore from '../store/useStructureStore';

const CanvasArea = () => {
  const { nodes, elements, loads, theme, units, showSFD, showBMD, results } = useStructureStore();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Update canvas size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute bounding box and scale to fit
  useEffect(() => {
    if (nodes.length === 0) return;
    const padding = 100;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y));

    const structWidth = maxX - minX || 1;
    const structHeight = maxY - minY || 1;

    const scaleX = (dimensions.width - padding * 2) / structWidth;
    const scaleY = (dimensions.height - padding * 2) / structHeight;
    const newScale = Math.min(scaleX, scaleY, 50); // Cap max scale

    setScale(newScale);
    setOffset({
      x: (dimensions.width - (structWidth * newScale)) / 2 - (minX * newScale),
      y: (dimensions.height + (structHeight * newScale)) / 2 + (minY * newScale) // Y is flipped in Canvas
    });
  }, [nodes, dimensions]);

  const mapX = (x) => offset.x + x * scale;
  const mapY = (y) => offset.y - y * scale; // Invert Y axis

  const strokeColor = theme === 'dark' ? '#94a3b8' : '#475569';
  const nodeColor = theme === 'dark' ? '#3b82f6' : '#2563eb';

  return (
    <div ref={containerRef} className="flex-1 glass-card rounded-2xl overflow-hidden relative m-4 ml-0 bg-white/50 dark:bg-slate-900/50 shadow-inner">
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          {/* Elements */}
          {elements.map(el => {
            const nodeI = nodes.find(n => n.id === el.i);
            const nodeJ = nodes.find(n => n.id === el.j);
            if (!nodeI || !nodeJ) return null;
            return (
              <Group key={`el-${el.id}`}>
                <Line
                  points={[mapX(nodeI.x), mapY(nodeI.y), mapX(nodeJ.x), mapY(nodeJ.y)]}
                  stroke={theme === 'dark' ? '#cbd5e1' : '#1e293b'}
                  strokeWidth={4}
                  lineCap="round"
                />
                <Text
                  x={(mapX(nodeI.x) + mapX(nodeJ.x)) / 2 + 10}
                  y={(mapY(nodeI.y) + mapY(nodeJ.y)) / 2 - 20}
                  text={`E${el.id}`}
                  fill={strokeColor}
                  fontSize={12}
                  fontStyle="bold"
                />
                <Text
                  x={(mapX(nodeI.x) + mapX(nodeJ.x)) / 2 + 10}
                  y={(mapY(nodeI.y) + mapY(nodeJ.y)) / 2 - 5}
                  text={`${Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y).toFixed(1)} ${units.length}`}
                  fill="#64748b"
                  fontSize={10}
                />
              </Group>
            );
          })}

          {/* Nodes and Supports */}
          {nodes.map(node => (
            <Group key={`node-${node.id}`} x={mapX(node.x)} y={mapY(node.y)}>
              {node.support === 'pin' && (
                <RegularPolygon sides={3} radius={14} fill={strokeColor} y={10} />
              )}
              {node.support === 'roller' && (
                 <RegularPolygon sides={3} radius={14} fill="transparent" stroke={strokeColor} strokeWidth={2} y={10} />
              )}
              {node.support === 'fixed' && (
                <Line points={[-15, 10, 15, 10]} stroke={strokeColor} strokeWidth={4} />
              )}
              <Circle
                radius={6}
                fill={nodeColor}
                stroke={theme === 'dark' ? '#1e293b' : '#ffffff'}
                strokeWidth={2}
              />
              <Text
                x={10}
                y={-20}
                text={`N${node.id} (${node.x}, ${node.y})`}
                fill={strokeColor}
                fontSize={12}
                fontFamily=" monospace"
              />
            </Group>
          ))}

          {/* Loads */}
          {loads.map(load => {
            if (load.type === 'point_load' && load.node_id) {
              const node = nodes.find(n => n.id === load.node_id);
              if (!node) return null;
              const isDown = load.direction === 'down';
              const directionSign = isDown ? 1 : -1;
              return (
                <Group key={`load-${load.id}`} x={mapX(node.x)} y={mapY(node.y)}>
                  <Arrow
                    points={[0, -40 * directionSign, 0, -10 * directionSign]}
                    stroke="#ef4444"
                    fill="#ef4444"
                    strokeWidth={3}
                    pointerLength={10}
                    pointerWidth={10}
                  />
                  <Text text={`${load.magnitude} ${units.force}`} fill="#ef4444" fontSize={12} x={10} y={-45 * directionSign} />
                </Group>
              );
            }
            if (load.type === 'point_load' && load.element_id) {
              const el = elements.find(e => e.id === load.element_id);
              if (!el) return null;
              const ni = nodes.find(n => n.id === el.i);
              const nj = nodes.find(n => n.id === el.j);
              if (!ni || !nj) return null;
              const L = Math.hypot(nj.x - ni.x, nj.y - ni.y);
              const ratio = (load.a !== undefined ? load.a : L/2) / L;
              const lx = ni.x + (nj.x - ni.x) * ratio;
              const ly = ni.y + (nj.y - ni.y) * ratio;
              const isDown = load.direction === 'down';
              const directionSign = isDown ? 1 : -1;
              return (
                <Group key={`load-${load.id}`} x={mapX(lx)} y={mapY(ly)}>
                  <Arrow
                    points={[0, -40 * directionSign, 0, -10 * directionSign]}
                    stroke="#ef4444"
                    fill="#ef4444"
                    strokeWidth={3}
                    pointerLength={10}
                    pointerWidth={10}
                  />
                  <Text text={`${load.magnitude} ${units.force}`} fill="#ef4444" fontSize={12} x={10} y={-45 * directionSign} />
                </Group>
              );
            }
            if (load.type === 'UDL' && load.element_id) {
               const el = elements.find(e => e.id === load.element_id);
               if (!el) return null;
               const ni = nodes.find(n => n.id === el.i);
               const nj = nodes.find(n => n.id === el.j);
               if (!ni || !nj) return null;
               
               const L = Math.hypot(nj.x - ni.x, nj.y - ni.y);
               const ratioA = (load.a !== undefined ? load.a : 0) / L;
               const ratioB = (load.b !== undefined ? load.b : L) / L;
               
               const lxStart = ni.x + (nj.x - ni.x) * ratioA;
               const lyStart = ni.y + (nj.y - ni.y) * ratioA;
               const lxEnd = ni.x + (nj.x - ni.x) * ratioB;
               const lyEnd = ni.y + (nj.y - ni.y) * ratioB;

               const isDown = load.direction === 'down' || !load.direction;
               const dirSign = isDown ? 1 : -1;
               const pxi = mapX(lxStart);
               const pyi = mapY(lyStart);
               const pxj = mapX(lxEnd);
               const pyj = mapY(lyEnd);
               return (
                 <Group key={`load-${load.id}`}>
                   <Line points={[pxi, pyi + (-20 * dirSign), pxj, pyj + (-20 * dirSign)]} stroke="#f97316" strokeWidth={2} />
                   <Arrow points={[pxi, pyi + (-20 * dirSign), pxi, pyi]} stroke="#f97316" fill="#f97316" pointerWidth={5} pointerLength={5} />
                   <Arrow points={[pxj, pyj + (-20 * dirSign), pxj, pyj]} stroke="#f97316" fill="#f97316" pointerWidth={5} pointerLength={5} />
                   <Text text={`${load.magnitude} ${units.force}/${units.length}`} fill="#f97316" fontSize={12} x={(pxi+pxj)/2} y={(pyi+pyj)/2 + (-35 * dirSign)} />
                 </Group>
               )
            }
            return null;
          })}

          {/* Diagrams (SFD / BMD) */}
          {results?.diagramData && (showSFD || showBMD) && elements.map(el => {
            const ni = nodes.find(n => n.id === el.i);
            const nj = nodes.find(n => n.id === el.j);
            if (!ni || !nj) return null;
            
            const dx = nj.x - ni.x;
            const dy = nj.y - ni.y;
            const L = Math.hypot(dx, dy);
            // Angle of element relative to local horizontal
            const angle = Math.atan2(dy, dx);
            
            // Map global points back to canvas coordinates
            const transformPoint = (localX, perpValue) => {
               // localX is along the element
               // perpValue is perpendicular to the element
               const ex = localX * Math.cos(angle) - perpValue * Math.sin(angle);
               const ey = localX * Math.sin(angle) + perpValue * Math.cos(angle);
               return [mapX(ni.x + ex), mapY(ni.y + ey)];
            };

            const sfdPts = results.diagramData.sfd.filter(d => d.elementId === el.id);
            const bmdPts = results.diagramData.bmd.filter(d => d.elementId === el.id);

            // Calculate scaling factors so diagrams look proportional (max 60px height)
            const maxSfd = results.diagramData.criticalValues.sfd;
            const sfdScale = Math.max(Math.abs(maxSfd.max), Math.abs(maxSfd.min)) > 0 ? 60 / Math.max(Math.abs(maxSfd.max), Math.abs(maxSfd.min)) : 1;
            
            const maxBmd = results.diagramData.criticalValues.bmd;
            const bmdScale = Math.max(Math.abs(maxBmd.max), Math.abs(maxBmd.min)) > 0 ? 60 / Math.max(Math.abs(maxBmd.max), Math.abs(maxBmd.min)) : 1;

            return (
              <Group key={`diagrams-${el.id}`}>
                {showSFD && sfdPts.length > 0 && (
                  <Line 
                    points={[
                      ...transformPoint(0, 0),
                      ...sfdPts.flatMap(pt => transformPoint(pt.localX, pt.value * sfdScale / scale)),
                      ...transformPoint(L, 0)
                    ]}
                    fill="rgba(239, 68, 68, 0.4)" // Red
                    stroke="#ef4444"
                    strokeWidth={1}
                    closed={true}
                  />
                )}
                {showBMD && bmdPts.length > 0 && (
                  <Line 
                    points={[
                      ...transformPoint(0, 0),
                      // BMD is usually drawn on the tension side, which inverses the sign. Let's flip it by default.
                      ...bmdPts.flatMap(pt => transformPoint(pt.localX, -pt.value * bmdScale / scale)),
                      ...transformPoint(L, 0)
                    ]}
                    fill="rgba(59, 130, 246, 0.4)" // Blue
                    stroke="#3b82f6"
                    strokeWidth={1}
                    closed={true}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>
      {nodes.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500 font-medium">
           Add nodes from the sidebar to begin drawing
         </div>
      )}
    </div>
  );
};

export default CanvasArea;
