import { parentPort } from 'node:worker_threads';
import {
  parseYmlItem,
  parseYmlFolder,
  parseYmlEnvironment,
  stringifyYmlItem,
  stringifyYmlFolder,
  stringifyYmlEnvironment
} from '../formats/yml';

type TaskType
  = | 'parse'
    | 'stringify'
    | 'parseFolder'
    | 'stringifyFolder'
    | 'parseEnvironment'
    | 'stringifyEnvironment';

interface WorkerMessage {
  taskType: TaskType;
  data: {
    data: any;
  };
}

const runTask = (taskType: TaskType, data: any): any => {
  switch (taskType) {
    case 'parse':
      return parseYmlItem(data);
    case 'stringify':
      return stringifyYmlItem(data);
    case 'parseFolder':
      return parseYmlFolder(data);
    case 'stringifyFolder':
      return stringifyYmlFolder(data);
    case 'parseEnvironment':
      return parseYmlEnvironment(data);
    case 'stringifyEnvironment':
      return stringifyYmlEnvironment(data);
    default:
      throw new Error(`Unknown task type: ${taskType}`);
  }
};

parentPort?.on('message', async (message: WorkerMessage) => {
  try {
    const { taskType, data: messageData } = message;
    const { data } = messageData;
    const result = runTask(taskType, data);
    parentPort?.postMessage(result);
  } catch (error: any) {
    console.error('Worker error:', error);
    parentPort?.postMessage({ error: error?.message });
  }
});
