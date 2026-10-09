export interface PublicRoomSummary {
  readonly lobbyId: string;
  readonly name: string;
  readonly mode: string;
  readonly hostUsername: string;
  readonly isPrivate: boolean;
  readonly playerCount: number;
  readonly maxPlayers: number;
  readonly createdAt: number;
}
