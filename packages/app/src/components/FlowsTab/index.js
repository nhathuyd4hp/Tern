import { useState } from 'react';
import { IconPlus, IconRoute } from '@tabler/icons';
import Button from 'ui/Button';
import { createFlow, saveFlow, useFlows } from 'utils/flows';
import FlowEditor from './FlowEditor';
import StyledWrapper from './StyledWrapper';

// The flows of one application: pick one on the left, edit and run it on the right.
const FlowsTab = ({ collection }) => {
  const flows = useFlows(collection);
  const [selectedId, setSelectedId] = useState(null);
  const selected = flows.find((flow) => flow.id === selectedId) || flows[0] || null;

  const addFlow = () => {
    const flow = createFlow(`Flow ${flows.length + 1}`);
    saveFlow(collection, flow);
    setSelectedId(flow.id);
  };

  return (
    <StyledWrapper className="flex h-full" data-testid="flows-tab">
      <aside className="flow-list">
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
            <span className="flow-list-count">{flow.steps.length}</span>
          </button>
        ))}
      </aside>

      <section className="flow-detail">
        {selected ? (
          <FlowEditor key={selected.id} application={collection} flow={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flow-empty">
            <IconRoute size={32} strokeWidth={1.25} />
            <h4>No flows yet</h4>
            <p>A flow runs several requests in order and passes values from one response to the next, such as a login token.</p>
            <Button onClick={addFlow}>Create a flow</Button>
          </div>
        )}
      </section>
    </StyledWrapper>
  );
};

export default FlowsTab;
