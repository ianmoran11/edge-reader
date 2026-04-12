export interface StorageQuota {
  usage: number;
  quota: number;
  percentUsed: number;
  isPersisted: boolean;
}

export function createStorageQuotaMonitor() {
  let listeners: Array<(quota: StorageQuota) => void> = [];
  let currentQuota: StorageQuota = {
    usage: 0,
    quota: 0,
    percentUsed: 0,
    isPersisted: false,
  };

  async function refresh() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persisted?.()) ?? false;

      currentQuota = {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
        percentUsed: estimate.quota
          ? ((estimate.usage ?? 0) / estimate.quota) * 100
          : 0,
        isPersisted: persisted,
      };

      listeners.forEach((l) => l(currentQuota));
    } catch {
      // silently fail
    }
  }

  function subscribe(listener: (quota: StorageQuota) => void) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }

  async function requestPersist(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) return false;
    return navigator.storage.persist();
  }

  return {
    refresh,
    subscribe,
    requestPersist,
    get current() {
      return currentQuota;
    },
  };
}
