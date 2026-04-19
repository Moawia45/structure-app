import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Circle, Line, Text, Group, RegularPolygon, Arrow } from 'react-konva';
import useStructureStore from '../store/useStructureStore';

const CanvasArea = () => {
  const { nodes, elements, theme, units } = useStructureStore();
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
