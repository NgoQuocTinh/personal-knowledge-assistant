'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  ForceGraphMethods,
  NodeObject,
  LinkObject
} from 'react-force-graph-2d';
import { graphApi } from '../services/graphApi';

// =====================
// TYPES
// =====================
interface MyNode extends NodeObject {
  id: string;
  group: 'existing' | 'ghost';
}

interface MyLink extends LinkObject {
  source: string;
  target: string;
}

interface GraphData {
  nodes: MyNode[];
  links: MyLink[];
}

interface GraphViewProps {
  onNodeClick: (nodeId: string) => void;
  width?: number;
  height?: number;
}

// =====================
// DYNAMIC IMPORT (typed)
// =====================
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  {
    ssr: false,
    loading: () => (
      <div className="text-gray-400">Loading Graph Engine...</div>
    )
  }
) as unknown as React.FC<{
  graphData: GraphData;
  width?: number;
  height?: number;
  nodeLabel?: string | ((node: MyNode) => string);
  nodeColor?: (node: MyNode) => string;
  nodeRelSize?: number;
  linkColor?: () => string;
  linkDirectionalParticles?: number;
  linkDirectionalParticleSpeed?: number;
  onNodeClick?: (node: MyNode) => void;
  cooldownTicks?: number;
  onEngineStop?: () => void;
  ref?: React.Ref<ForceGraphMethods>;
}>;

// =====================
// COMPONENT
// =====================
export default function GraphView({
  onNodeClick,
  width,
  height
}: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fgRef = useRef<ForceGraphMethods | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadGraph = async () => {
      try {
        setIsLoading(true);
        const data = await graphApi.fetchGraphData(controller.signal);

        // đảm bảo đúng shape
        setGraphData({
          nodes: data.nodes as MyNode[],
          links: data.links as MyLink[]
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load graph data', err);
          setError('Could not load knowledge graph');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadGraph();
    return () => controller.abort();
  }, []);

  const handleNodeClick = (node: MyNode) => {
    if (node.group === 'existing') {
      onNodeClick(node.id);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        Loading Network...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-50 flex items-center justify-center overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeLabel="id"
        nodeColor={(node: MyNode) =>
          node.group === 'ghost' ? '#d1d5db' : '#3b82f6'
        }
        nodeRelSize={6}
        linkColor={() => '#cbd5e1'}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        onNodeClick={handleNodeClick}
        cooldownTicks={100}
        onEngineStop={() => {
          fgRef.current?.zoomToFit(400);
        }}
      />
    </div>
  );
}