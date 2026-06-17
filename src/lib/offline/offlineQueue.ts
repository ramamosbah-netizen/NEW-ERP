import { logger } from '@/lib/logger';
const DB_NAME = 'jeet_erp_offline';
const STORE_NAME = 'operations_queue';
const DB_VERSION = 1;

export interface QueuedOperation {
  id: string;
  module: string;
  action: string;
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  error?: string;
}

/**
 * Open/Initialize Native IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in browser contexts.'));
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineQueue = {
  /**
   * Enqueues an operation to be synced later.
   */
  async enqueueOperation(module: string, action: string, payload: any): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const op: QueuedOperation = {
        id: crypto.randomUUID(),
        module,
        action,
        payload,
        timestamp: new Date().toISOString(),
        status: 'PENDING'
      };

      const request = store.add(op);
      request.onsuccess = () => {
        logger.debug(`Enqueued offline operation: ${module}.${action}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Fetches all queued operations.
   */
  async getQueuedOperations(): Promise<QueuedOperation[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Removes an operation from the queue by ID.
   */
  async deleteOperation(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Updates the status/error message of an operation.
   */
  async updateOperationStatus(id: string, status: 'PENDING' | 'SYNCING' | 'FAILED', error?: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Get the existing item first
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.status = status;
          if (error) data.error = error;
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  /**
   * Triggers the synchronization loop for all pending operations.
   */
  async syncQueue(onProgress?: (op: QueuedOperation, success: boolean) => void): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      logger.debug('Skipping offline sync: Network is currently offline.');
      return;
    }

    const ops = await this.getQueuedOperations();
    const pending = ops.filter(o => o.status === 'PENDING' || o.status === 'FAILED');
    
    if (pending.length === 0) return;

    logger.debug(`Starting background sync for ${pending.length} operations...`);

    for (const op of pending) {
      try {
        await this.updateOperationStatus(op.id, 'SYNCING');

        // Resolve module routes dynamically
        if (op.module === 'INVENTORY' && op.action === 'CREATE_GRN') {
          const { grnService } = await import('@/services/grnService');
          await grnService.recordGRN(op.payload.grnData, op.payload.items, op.payload.ignoreTolerance);
        } else if (op.module === 'TESTING' && op.action === 'CREATE_SNAG') {
          const { snagService } = await import('@/services/snagService');
          await snagService.createSnag(op.payload);
        } else if (op.module === 'HR' && op.action === 'SUBMIT_TIMESHEET') {
          const { timesheetService } = await import('@/services/timesheetService');
          await timesheetService.submitTimesheet(op.payload);
        } else {
          throw new Error(`Unsupported sync command: ${op.module}.${op.action}`);
        }

        // Successfully synced: clear from queue
        await this.deleteOperation(op.id);
        if (onProgress) onProgress(op, true);
        logger.debug(`Successfully synced offline operation ${op.id}`);
      } catch (err: any) {
        logger.error(`Offline sync failed for operation ${op.id}:`, err);
        await this.updateOperationStatus(op.id, 'FAILED', err.message || 'Unknown network error');
        if (onProgress) onProgress(op, false);
      }
    }
  }
};

// Bind online events to trigger synchronization automatically
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    logger.debug('Browser online event detected. Running syncQueue...');
    offlineQueue.syncQueue();
  });
}

export default offlineQueue;
