import { IconPlus, IconX } from '@tabler/icons';
import Button from 'ui/Button';
import VariableField from '../VariableField';
import StyledWrapper from './StyledWrapper';

// What a WebSocket request does in a flow: the messages it sends one after the other, and the text a message
// received must hold before the node goes on through RECEIVED (any message when empty).
const WebSocketSection = ({ node, suggestions, disabled, onChange }) => {
  const messages = node.send || [];
  const setMessages = (send) => onChange({ ...node, send });

  return (
    <StyledWrapper data-testid="websocket-section">
      <div className="ws-title">Send</div>
      {messages.map((message, position) => (
        <div className="ws-message" key={position}>
          <VariableField
            multiline
            rows={3}
            aria-label={`Message ${position + 1} to send`}
            placeholder='{"type": "subscribe"} or {{variable}}'
            value={message}
            disabled={disabled}
            suggestions={suggestions}
            onValueChange={(text) => setMessages(messages.map((current, i) => (i === position ? text : current)))}
          />
          <Button size="xs" variant="ghost" color="secondary" disabled={disabled} icon={<IconX size={14} />} onClick={() => setMessages(messages.filter((_, i) => i !== position))} title="Remove message" />
        </div>
      ))}
      <Button size="xs" variant="ghost" disabled={disabled} icon={<IconPlus size={14} />} onClick={() => setMessages([...messages, ''])}>
        Add a message
      </Button>

      <div className="ws-title">Receive</div>
      <VariableField
        aria-label="Text a received message must hold"
        placeholder="any message"
        value={node.expect || ''}
        disabled={disabled}
        suggestions={suggestions}
        onValueChange={(expect) => onChange({ ...node, expect })}
      />
    </StyledWrapper>
  );
};

export default WebSocketSection;
