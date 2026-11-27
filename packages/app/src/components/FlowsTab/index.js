import { useState } from 'react';
import { IconPlus, IconRoute } from '@tabler/icons';
import Button from 'ui/Button';
import { createFlow, saveFlow, useFlows } from 'utils/flows';
import FlowEditor from './FlowEditor';
import ResizeHandle from './ResizeHandle';
import StyledWrapper from './StyledWrapper';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The flows of one application: pick one on the left, edit and run it on the right.
const FlowsTab = ({ collection }) => {
  const flows = useFlows(collection);
  const [selectedId, setSelectedId] = useState(null);
  const [listWidth, setListWidth] = useState(240);
  const selected = flows.find((flow) => flow.id === selectedId) || flows[0] || null;

  const addFlow = () => {
    const flow = createFlow(`Flow ${flows.length + 1}`);
    saveFlow(collection, flow);
    setSelectedId(flow.id);
  };

  return (
    <StyledWrapper className="flex h-full" data-testid="flows-tab">
      <aside className="flow-list" style={{ flex: `0 0 ${listWidth}px` }}>
        <div className="flow-list-header">
          <span className="flow-list-title">Flows</span>
          <Button size="xs" variant="outline" icon={<IconPlus size={14} />} onClick={addFlow} data-testid="flow-new">
            New
          </Button>
        </div>
        {flows.map((flow) => (
          <button
            type="button"
            key={flow.id}
            className={`flow-list-item ${selected?.id === flow.id ? 'selected' : ''}`}
            onClick={() => setSelectedId(flow.id)}
          >
            <IconRoute size={14} strokeWidth={1.5} />
            <span className="flow-list-name">{flow.name}</span>
            <span className="flow-list-count">{flow.nodes.length}</span>
          </button>
        ))}
      </aside>
      <ResizeHandle label="Resize the list of flows" onResize={(delta) => setListWidth((width) => clamp(width + delta, 140, 480))} />

      <section className="flow-detail">
        {selected ? (
          <FlowEditor key={selected.id} application={collection} flow={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flow-empty">
            <IconRoute size={32} strokeWidth={1.25} />
            <h4>No flows yet</h4>
            <p>A flow connects requests on a canvas: the status of each response picks the next request, and values such as a login token pass from one response to the next.</p>
            <Button onClick={addFlow}>Create a flow</Button>
          </div>
        )}
      </section>
    </StyledWrapper>
  );
};

export default FlowsTab;
