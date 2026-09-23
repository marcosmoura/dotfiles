import net from "node:net";

const REQUEST_TIMEOUT_MS = 5_000;

export type HerdrCall = (method: string, params: Record<string, unknown>) => Promise<unknown>;

/**
 * Minimal newline-delimited JSON client for the Herdr socket API. Used for the
 * layout methods that have no CLI wrapper.
 */
export function createHerdrSocket(socketPath: string): HerdrCall {
  const endpoint = process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;

  return (method, params) =>
    new Promise((resolve, reject) => {
      const client = net.createConnection(endpoint);
      let buffer = "";
      let settled = false;

      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        client.destroy();
        settle();
      };

      const timer = setTimeout(
        () => finish(() => reject(new Error(`herdr ${method} timed out`))),
        REQUEST_TIMEOUT_MS,
      );
      timer.unref?.();

      client.setEncoding("utf8");
      client.on("connect", () => {
        client.write(`${JSON.stringify({ id: `${Date.now()}-${Math.random()}`, method, params })}\n`);
      });
      client.on("data", (chunk: string) => {
        buffer += chunk;
        const newline = buffer.indexOf("\n");
        if (newline === -1) return;
        const line = buffer.slice(0, newline);
        clearTimeout(timer);
        finish(() => {
          try {
            const response = JSON.parse(line) as { result?: unknown; error?: { message?: string } };
            if (response.error) reject(new Error(response.error.message ?? `herdr ${method} failed`));
            else resolve(response.result);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      });
      client.on("error", (error) => {
        clearTimeout(timer);
        finish(() => reject(error));
      });
    });
}
