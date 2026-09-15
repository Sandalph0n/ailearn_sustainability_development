import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectionMode, type ReactFlowProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import type { ReplayDiagramPage } from './model';

const captured = vi.hoisted(() => ({ props: null as ReactFlowProps | null }));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    Background: () => null,
    Controls: () => null,
    ReactFlow: (props: ReactFlowProps) => {
      captured.props = props;
      return <div />;
    },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
    useReactFlow: () => ({ fitView: vi.fn() }),
  };
});

vi.mock('@/lib/flow/edges/ConnectionEdge', () => ({ default: () => null }));
vi.mock('@/lib/flow/nodes/anchor/AnchorNode', () => ({ default: () => null }));
vi.mock('@/lib/flow/nodes/anchor/anchor', () => ({ ANCHOR_NODE_TYPE: 'anchor' }));
vi.mock('@/lib/flow/nodes/registry', () => ({ buildNodeTypesMap: () => ({}) }));

import ReplayCanvas from './ReplayCanvas';

describe('ReplayCanvas', () => {
  it('renders stored source-to-source handles with the same loose connection mode as the editor', () => {
    const page: ReplayDiagramPage = {
      id: 'page-1',
      name: 'Page 1',
      nodes: [],
      edges: [],
    };

    renderToStaticMarkup(<ReplayCanvas page={page} />);

    expect(captured.props?.connectionMode).toBe(ConnectionMode.Loose);
  });
});
