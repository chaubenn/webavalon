type SocketMessage = Record<string, unknown>;

type SocketOptions = {
  onMessage: (data: SocketMessage) => void;
  onStatus?: (status: "connected" | "reconnecting" | "closed") => void;
};

export function createLobbySocket(code: string, options: SocketOptions) {
  let socket: WebSocket | null = null;
  let closed = false;
  let retries = 0;
  const queue: SocketMessage[] = [];

  const connect = () => {
    if (closed) {
      return;
    }
    const base =
      process.env.NEXT_PUBLIC_API_BASE || "https://avalon-worker.benjaminchau05.workers.dev";
    const url = new URL(base);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    const wsBase = `${wsProtocol}//${url.host}`;
    socket = new WebSocket(`${wsBase}/api/lobbies/${code}/ws`);

    socket.addEventListener("open", () => {
      retries = 0;
      options.onStatus?.("connected");
      while (queue.length) {
        const payload = queue.shift();
        if (payload) {
          socket?.send(JSON.stringify(payload));
        }
      }
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as SocketMessage;
        options.onMessage(payload);
      } catch {
        options.onMessage({ type: "error", message: "Bad message format." });
      }
    });

    socket.addEventListener("close", () => {
      if (closed) {
        options.onStatus?.("closed");
        return;
      }
      options.onStatus?.("reconnecting");
      retries += 1;
      const timeout = Math.min(1000 * 2 ** retries, 10000);
      window.setTimeout(connect, timeout);
    });
  };

  const send = (payload: SocketMessage) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      queue.push(payload);
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const close = () => {
    closed = true;
    socket?.close();
  };

  connect();

  return { send, close };
}
