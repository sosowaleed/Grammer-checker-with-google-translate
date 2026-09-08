import { ExtensionMessage } from './types';

// Dynamic Keep-Alive Manager for Manifest V3 Service Worker
export class KeepAliveManager {
  private static port: any = null;
  private static pingInterval: ReturnType<typeof setInterval> | null = null;
  private static reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private static isPortActive = false;

  public static activate(): void {
    if (this.isPortActive) return;
    this.isPortActive = true;
    this.connect();
  }

  public static deactivate(): void {
    this.isPortActive = false;
    this.disconnect();
  }

  private static connect(): void {
    if (!this.isPortActive) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.connect) {
        this.port = chrome.runtime.connect({ name: 'polyglot-keepalive' });
      } else if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser?.runtime?.connect) {
        this.port = (globalThis as any).browser.runtime.connect({ name: 'polyglot-keepalive' });
      }

      if (this.port) {
        this.port.onDisconnect?.addListener(() => {
          this.port = null;
          if (this.isPortActive) {
            // Reconnect after brief pause
            setTimeout(() => this.connect(), 500);
          }
        });

        // 20-second heartbeat to prevent service worker 30-second sleep
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.port) {
            try {
              this.port.postMessage({ type: 'PING' });
            } catch {
              this.disconnect();
              this.connect();
            }
          }
        }, 20000);

        // Preemptively cycle port after 4.5 minutes to stay ahead of Chrome 5-min hard timeout
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          if (this.isPortActive) {
            this.disconnect();
            this.connect();
          }
        }, 270000);
      }
    } catch {
      // Ignore keepalive failures
    }
  }

  private static disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.port) {
      try {
        this.port.disconnect();
      } catch {}
      this.port = null;
    }
  }
}

// Low-level single dispatch helper
function dispatchMessageOnce<T = any>(message: ExtensionMessage): Promise<T> {
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
          const ret: unknown = chrome.runtime.sendMessage(message, (response) => {
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

// Resilient sendRuntimeMessage with retry on service worker wake-up
export async function sendRuntimeMessage<T = any>(message: ExtensionMessage, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result: any = await dispatchMessageOnce<T>(message);
    const errMsg = result?.error;

    // If service worker is inactive or waking up, retry with slight backoff
    const isWakingUp =
      typeof errMsg === 'string' &&
      (errMsg.includes('Could not establish connection') ||
        errMsg.includes('Receiving end does not exist') ||
        errMsg.includes('Extension runtime unavailable'));

    if (isWakingUp && attempt < retries) {
      // Trigger keepalive to ensure service worker is booted
      KeepAliveManager.activate();
      await new Promise((r) => setTimeout(r, (attempt + 1) * 120));
      continue;
    }

    return result;
  }
  return { error: 'Service worker unreachable after retry' } as any;
}

