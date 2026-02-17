import { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Box } from '@mui/material';
import type { Milestone, Task } from '../types';
import { useMilestones, useMilestoneDependencies, useTasksByProject } from '../hooks/useDatabase';
import FlowNode from '../components/FlowNode';
import type { FlowNodeData } from '../components/FlowNode';

const nodeTypes = { milestone: FlowNode };

const layoutNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 50 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 200, height: 90 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 100, y: pos.y - 45 } };
  });
};

interface DependencyFlowProps {
  projectId: number;
}

const DependencyFlow = ({ projectId }: DependencyFlowProps) => {
  const milestones = useMilestones(projectId);
  const deps = useMilestoneDependencies(projectId);
  const tasks = useTasksByProject(projectId);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (milestones.length === 0) return;

    const taskCountsFor = (mId: number) => {
      const mt = tasks.filter((t: Task) => t.milestone_id === mId);
      return { tasksTotal: mt.length, tasksDone: mt.filter((t: Task) => t.status === 'done').length };
    };

    const rawNodes: Node[] = milestones.map((m: Milestone) => ({
      id: String(m.id),
      type: 'milestone',
      position: { x: 0, y: 0 },
      data: { milestone: m, ...taskCountsFor(m.id) } as FlowNodeData,
    }));

    const rawEdges: Edge[] = deps.map((d) => ({
      id: `${d.depends_on_milestone_id}-${d.milestone_id}`,
      source: String(d.depends_on_milestone_id),
      target: String(d.milestone_id),
      animated: true,
      style: { stroke: '#90caf9', strokeWidth: 2 },
    }));

    setNodes(layoutNodes(rawNodes, rawEdges));
    setEdges(rawEdges);
  }, [milestones, deps, tasks, setNodes, setEdges]);

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable style={{ height: 80, width: 120 }} />
      </ReactFlow>
    </Box>
  );
};

export default DependencyFlow;
