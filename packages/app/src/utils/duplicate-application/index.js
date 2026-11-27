import { useSyncExternalStore } from 'react';

// The question "this name is taken, what now?" is put to the user from inside thunks, so it waits here and not in Redux
// (it holds functions). One question is open at a time: the imports and creations that ask it run one after another.
let pending = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Ask what to do about a name that is already in use. `isTaken(name)` tells whether another name is free.
 * Resolves with { choice: 'keep' | 'replace' | 'cancel' } or { choice: 'rename', name }.
 */
export const askDuplicateApplication = ({ name, isTaken }) => new Promise((resolve) => {
  pending = { name, isTaken, resolve };
  notify();
});

export const answerDuplicateApplication = (answer) => {
  const question = pending;
  pending = null;
  notify();
  question?.resolve(answer);
};

export const useDuplicateApplicationQuestion = () => useSyncExternalStore(subscribe, () => pending);
