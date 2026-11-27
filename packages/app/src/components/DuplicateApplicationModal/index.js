import { useState } from 'react';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import { DUPLICATE_APPLICATION_NAME_ERROR } from 'utils/application-name';
import { answerDuplicateApplication, useDuplicateApplicationQuestion } from 'utils/duplicate-application';
import StyledWrapper from './StyledWrapper';

const Question = ({ question }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(question.name);
  const [error, setError] = useState('');

  const continueWithAnotherName = () => {
    const name = newName.trim();
    if (!name) {
      setError('Application name is required');
    } else if (question.isTaken(name)) {
      setError(DUPLICATE_APPLICATION_NAME_ERROR);
    } else {
      answerDuplicateApplication({ choice: 'rename', name });
    }
  };

  return (
    <Portal>
      <Modal
        size="md"
        title={`“${question.name}” already exists`}
        hideFooter
        handleCancel={() => answerDuplicateApplication({ choice: 'cancel' })}
        dataTestId="duplicate-application-modal"
      >
        <StyledWrapper role="dialog" aria-label={`“${question.name}” already exists`}>
          <p className="lead">Two applications can’t share a name. What should happen?</p>

          {isRenaming ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                continueWithAnotherName();
              }}
            >
              <label htmlFor="duplicate-application-name" className="font-medium">New name</label>
              <input
                id="duplicate-application-name"
                data-testid="duplicate-application-name-input"
                className="block textbox w-full"
                autoFocus
                autoComplete="off"
                spellCheck="false"
                value={newName}
                onChange={(event) => {
                  setNewName(event.target.value);
                  setError('');
                }}
              />
              {error ? <div className="text-red-500" data-testid="duplicate-application-error">{error}</div> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" color="secondary" variant="ghost" onClick={() => setIsRenaming(false)}>Back</Button>
                <Button type="submit" data-testid="duplicate-application-continue">Continue</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              <button type="button" className="choice" onClick={() => answerDuplicateApplication({ choice: 'keep' })} data-testid="duplicate-application-keep">
                <span className="choice-title">Keep the existing one</span>
                <span className="choice-detail">Cancel this and open the application you already have.</span>
              </button>
              <button type="button" className="choice" onClick={() => answerDuplicateApplication({ choice: 'replace' })} data-testid="duplicate-application-replace">
                <span className="choice-title">Use the new one</span>
                <span className="choice-detail">The existing application leaves the workspace. Its files stay on disk.</span>
              </button>
              <button type="button" className="choice" onClick={() => setIsRenaming(true)} data-testid="duplicate-application-rename">
                <span className="choice-title">Use another name</span>
                <span className="choice-detail">Keep both, with a different name for the new one.</span>
              </button>
            </div>
          )}
        </StyledWrapper>
      </Modal>
    </Portal>
  );
};

// Asked from the thunks that create or import an application, before it is added to the workspace.
const DuplicateApplicationModal = () => {
  const question = useDuplicateApplicationQuestion();
  return question ? <Question key={question.name} question={question} /> : null;
};

export default DuplicateApplicationModal;
