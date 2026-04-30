import { API_BASE_URL } from './config';

export interface GraphNode {
  id: string;
  label: string;
  group: 'existing' | 'ghost';
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[]; // react-force-graph uses standard 'nodes' & 'links'
}

export const graphApi = {
  fetchGraphData: async (signal?: AbortSignal): Promise<GraphData> => {
    const res = await fetch(`${API_BASE_URL}/api/graph/`, {
      method: 'GET',
      signal,
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch graph data');
    }
    
    const data = await res.json();
    // Rename 'edges' coming from backend into 'links' for react-force-graph
    return {
      nodes: data.nodes,
      links: data.edges
    };
  }
};
