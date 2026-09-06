import { ExtensionMessage } from './types';

export function sendRuntimeMessage<T = any>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message } as any);
          } else {
            resolve(response);
          }
        });
        return;
      }
      if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser?.runtime?.sendMessage) {
        (globalThis as any).browser.runtime.sendMessage(message).then(resolve).catch((err: any) => {
          resolve({ error: err?.message } as any);
        });
        return;
      }
      resolve({ error: 'Extension runtime unavailable' } as any);
    } catch (err: any) {
      resolve({ error: err?.message } as any);
    }
  });
}
