import { NextResponse } from 'next/server';
import { inMemoryLobbyStore } from '../../../server/state/memory';
import { PublicRoomSummary } from '../../../types/rooms';

export type { PublicRoomSummary };

const globalRooms = globalThis as unknown as {
  __tdv_rooms_map?: Map<string, PublicRoomSummary>;
};

function getRoomsMap(): Map<string, PublicRoomSummary> {
  if (!globalRooms.__tdv_rooms_map) {
    globalRooms.__tdv_rooms_map = new Map<string, PublicRoomSummary>();
  }
  return globalRooms.__tdv_rooms_map;
}

export async function GET() {
  const map = getRoomsMap();
  const now = Date.now();
  const maxRoomAgeMs = 3 * 60 * 60 * 1000; // 3 hours

  // Prune expired rooms and synchronize with active in-memory lobbies
  for (const [id, room] of map.entries()) {
    if (now - room.createdAt > maxRoomAgeMs) {
      map.delete(id);
      continue;
    }

    const activeLobby = inMemoryLobbyStore.getLobby(room.lobbyId);
    if (activeLobby) {
      if (activeLobby.phase === 'ENDED') {
        map.delete(id);
        continue;
      }
      const count = Object.keys(activeLobby.players).length;
      if (count > 0 && count !== room.playerCount) {
        map.set(id, { ...room, playerCount: count });
      }
    }
  }

  const rooms = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({
    rooms,
    totalCount: rooms.length,
    timestamp: Date.now(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const map = getRoomsMap();

    const lobbyId = String(body.lobbyId || `room-${Date.now()}`);
    const name = String(body.name || 'Yeni Mafiya Masası');
    const mode = String(body.mode || 'BLITZ');
    const hostUsername = String(body.hostUsername || 'Host');
    const isPrivate = Boolean(body.isPrivate);
    const maxPlayers = Number(body.maxPlayers) || 12;

    const newRoom: PublicRoomSummary = {
      lobbyId,
      name,
      mode,
      hostUsername,
      isPrivate,
      playerCount: 1,
      maxPlayers,
      createdAt: Date.now(),
    };

    map.set(lobbyId, newRoom);

    return NextResponse.json({
      success: true,
      room: newRoom,
      roomUrl: `/lobby/${lobbyId}`,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_ROOM_PAYLOAD' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const lobbyId = url.searchParams.get('lobbyId');
    if (!lobbyId) {
      return NextResponse.json({ error: 'MISSING_LOBBY_ID' }, { status: 400 });
    }
    const map = getRoomsMap();
    map.delete(lobbyId);
    return NextResponse.json({ success: true, removed: lobbyId });
  } catch {
    return NextResponse.json({ error: 'FAILED_TO_DELETE' }, { status: 500 });
  }
}
