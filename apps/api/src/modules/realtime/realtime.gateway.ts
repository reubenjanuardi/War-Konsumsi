import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  CategoryQuotaUpdatedPayload,
  EventStatusUpdatedPayload,
  SOCKET_EVENTS,
} from '@war-konsumsi/shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_EVENT)
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    if (!data?.eventId) {
      return { success: false, message: 'eventId is required' };
    }
    const room = `event:${data.eventId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { success: true, eventId: data.eventId };
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_EVENT)
  handleLeaveEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    if (!data?.eventId) {
      return { success: false, message: 'eventId is required' };
    }
    const room = `event:${data.eventId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
    return { success: true, eventId: data.eventId };
  }

  broadcastQuotaUpdate(eventId: string, payload: CategoryQuotaUpdatedPayload): void {
    if (!this.server) return;
    this.server.to(`event:${eventId}`).emit(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, payload);
    this.logger.log(
      `Broadcast quota update [event:${eventId}]: category=${payload.categoryId}, remaining=${payload.remainingQuota}, status=${payload.status}`,
    );
  }

  broadcastEventStatus(eventId: string, payload: EventStatusUpdatedPayload): void {
    if (!this.server) return;
    this.server.to(`event:${eventId}`).emit(SOCKET_EVENTS.EVENT_STATUS_UPDATED, payload);
    this.logger.log(
      `Broadcast event status [event:${eventId}]: status=${payload.status}`,
    );
  }
}
