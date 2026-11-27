import { useSyncExternalStore } from 'react';

// The name of this machine, asked of the main process once. It is empty until the answer arrives.
let hostname = '';
let requested = false;
const listeners = new Set();

const request = () => {
  requested = true;
  window.ipcRenderer.invoke('renderer:get-hostname').then((name) => {
    hostname = name || '';
    listeners.forEach((listener) => listener());
  }, () => {});
};

const subscribe = (listener) => {
  listeners.add(listener);
  if (!requested) request();
  return () => listeners.delete(listener);
};

export const useHostname = () => useSyncExternalStore(subscribe, () => hostname);
