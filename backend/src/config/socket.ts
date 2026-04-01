import type { Server as SocketIOServer } from "socket.io";

let socketServer: SocketIOServer | null = null;

export function registerSocketServer(io: SocketIOServer): void {
  socketServer = io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!socketServer) {
    return;
  }

  socketServer.to(`user:${userId}`).emit(event, payload);
}
