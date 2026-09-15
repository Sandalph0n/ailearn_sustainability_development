import { useEffect } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';

import ConnectionEdge from '@/lib/flow/edges/ConnectionEdge';
import AnchorNode from '@/lib/flow/nodes/anchor/AnchorNode';
import { ANCHOR_NODE_TYPE } from '@/lib/flow/nodes/anchor/anchor';
import { buildNodeTypesMap } from '@/lib/flow/nodes/registry';
import type { ReplayDiagramPage } from './model';

const nodeTypes: NodeTypes = {
  ...buildNodeTypesMap(),
  [ANCHOR_NODE_TYPE]: AnchorNode,
};
const edgeTypes: EdgeTypes = { connection: ConnectionEdge };

function ReplayFlow({ page }: { page: ReplayDiagramPage }) {
  const flow = useReactFlow();

  useEffect(() => {
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      // React Flow measures newly reconstructed nodes after its first paint. Fitting on the
      // following frame keeps nodes introduced by this event above the transport panel.
      innerFrame = requestAnimationFrame(() => {
        void flow.fitView({ padding: 0.2, maxZoom: 1.25, duration: 180 });
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [flow, page.id, page.nodes, page.edges]);

  return (
    <ReactFlow
      nodes={page.nodes}
      edges={page.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: 'connection' }}
      connectionMode={ConnectionMode.Loose}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll
      fitView
      fitViewOptions={{ padding: 0.16, maxZoom: 1.25 }}
      proOptions={{ hideAttribution: true }}
      className="replay-canvas"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d7dddd" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export default function ReplayCanvas({ page }: { page: ReplayDiagramPage }) {
  return (
    <ReactFlowProvider>
      <ReplayFlow page={page} />
    </ReactFlowProvider>
  );
}
