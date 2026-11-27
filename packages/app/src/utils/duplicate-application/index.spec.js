import { answerDuplicateApplication, askDuplicateApplication } from './index';

describe('duplicate application question', () => {
  it('waits for the answer and resolves the question with it', async () => {
    const isTaken = () => false;
    const asked = askDuplicateApplication({ name: 'Orders', isTaken });

    answerDuplicateApplication({ choice: 'keep' });

    await expect(asked).resolves.toEqual({ choice: 'keep' });
  });

  it('ignores an answer when nothing was asked', () => {
    expect(() => answerDuplicateApplication({ choice: 'keep' })).not.toThrow();
  });
});
