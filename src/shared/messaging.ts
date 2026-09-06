import { ExtensionMessage } from './types';

export function sendRuntimeMessage<T = any>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: any) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const ret = chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              safeResolve({ error: chrome.runtime.lastError.message } as any);
            } else {
              safeResolve(response);
            }
          });
          if (ret && typeof (ret as any).then === 'function') {
            (ret as Promise<any>).then(safeResolve).catch((err: any) => {
              safeResolve({ error: err?.message } as any);
            });
          }
        } catch (err: any) {
          safeResolve({ error: err?.message } as any);
        }
        return;
      }
      if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser?.runtime?.sendMessage) {
        (globalThis as any).browser.runtime.sendMessage(message).then(safeResolve).catch((err: any) => {
          safeResolve({ error: err?.message } as any);
        });
        return;
      }
      safeResolve({ error: 'Extension runtime unavailable' } as any);
    } catch (err: any) {
      safeResolve({ error: err?.message } as any);
    }
  });
}
