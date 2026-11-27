import WorkerQueue from './WorkerQueue';
import { Lane } from '../types';
import path from 'node:path';

const sizeInMB = (size: number): number => {
  return size / (1024 * 1024);
};

const getSize = (data: any): number => {
  return sizeInMB(typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : Buffer.byteLength(JSON.stringify(data), 'utf8'));
};

/**
 * Lanes are used to determine which worker queue to use based on the size of the data.
 *
 * The first lane is for smaller files (<0.1MB), the second lane is for larger files (>=0.1MB).
 * This helps with parsing performance.
 */
const LANES: Lane[] = [{
  maxSize: 0.005
}, {
  maxSize: 0.1
}, {
  maxSize: 1
}, {
  maxSize: 10
}, {
  maxSize: 100
}];

interface WorkerQueueWithSize {
  maxSize: number;
  workerQueue: WorkerQueue;

}

class FileParserWorker {
  private workerQueues: WorkerQueueWithSize[];

  constructor() {
    this.workerQueues = LANES?.map((lane) => ({
      maxSize: lane?.maxSize,
      workerQueue: new WorkerQueue()
    }));
  }

  private getWorkerQueue(size: number): WorkerQueue {
    // Find the first queue that can handle the given size
    // or fallback to the last queue for largest files
    const queueForSize = this.workerQueues.find((queue) =>
      queue.maxSize >= size
    );

    return queueForSize?.workerQueue ?? this.workerQueues[this.workerQueues.length - 1].workerQueue;
  }

  private async enqueueTask({
    data,
    taskType
  }: {
    data: any;
    taskType: 'parse' | 'stringify' | 'parseFolder' | 'stringifyFolder' | 'parseEnvironment' | 'stringifyEnvironment';
  }): Promise<any> {
    const size = getSize(data);
    const workerQueue = this.getWorkerQueue(size);
    const workerScriptPath = path.join(__dirname, './workers/worker-script.js');

    return workerQueue.enqueue({
      data: { data },
      priority: size,
      scriptPath: workerScriptPath,
      taskType
    });
  }

  async parseRequest(data: any): Promise<any> {
    return this.enqueueTask({ data, taskType: 'parse' });
  }

  async stringifyRequest(data: any): Promise<any> {
    return this.enqueueTask({ data, taskType: 'stringify' });
  }

  async parseFolder(data: any): Promise<any> {
    return this.enqueueTask({ data, taskType: 'parseFolder' });
  }

  async stringifyFolder(data: any): Promise<any> {
    return this.enqueueTask({ data, taskType: 'stringifyFolder' });
  }

  async parseEnvironment(data: any): Promise<any> {
    return this.enqueueTask({ data, taskType: 'parseEnvironment' });
  }

  async stringifyEnvironment(data: any): Promise<any> {
    return this.enqueueTask({ data, taskType: 'stringifyEnvironment' });
  }

  async cleanup(): Promise<void> {
    const cleanupPromises = this.workerQueues.map(({ workerQueue }) =>
      workerQueue.cleanup()
    );
    await Promise.allSettled(cleanupPromises);
  }
}

export default FileParserWorker;
