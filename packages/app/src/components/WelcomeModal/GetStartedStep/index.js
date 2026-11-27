import React from 'react';
import { IconPlus, IconFileImport, IconSend } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const GetStartedStep = ({ onCreateCollection, onOpenCollection, onStartRequest }) => (
  <StyledWrapper className="step-body">
    <div className="step-label">Your first application</div>
    <div className="step-title">You're all set! What's next?</div>
    <div className="step-description">
      Create a new application to start building requests, or import one you already have.
    </div>

    <div className="primary-actions">
      <button className="primary-action-card" onClick={onCreateCollection}>
        <div className="card-icon">
          <IconPlus size={20} stroke={1.5} />
        </div>
        <div className="card-title">Create Application</div>
        <div className="card-desc">Start fresh with a new API application</div>
      </button>
    </div>

    <div className="secondary-actions">
      <button className="secondary-action" onClick={onOpenCollection}>
        <span className="secondary-icon">
          <IconFileImport size={16} stroke={1.5} />
        </span>
        <div>
          <div className="secondary-label">Import existing application</div>
          <div className="secondary-desc">Import a Tern application from your filesystem</div>
        </div>
      </button>
      <button className="secondary-action" onClick={onStartRequest}>
        <span className="secondary-icon">
          <IconSend size={16} stroke={1.5} />
        </span>
        <div>
          <div className="secondary-label">Get started with a request</div>
          <div className="secondary-desc">Jump right in with a new HTTP request</div>
        </div>
      </button>
    </div>
  </StyledWrapper>
);

export default GetStartedStep;
