import { pool } from "#config/dbConfig.js";

const ROOM_SELECT = `
  SELECT
    r.id,
    r.title,
    r.status,
    r.mode,
    r.game_mode AS gameMode,
    r.difficulty,
    r.language,
    r.problem_count AS problemCount,
    r.max_players AS maxPlayers,
    r.host_user_id AS hostUserId,
    r.created_at AS createdAt,
    CASE WHEN r.password <> '' THEN 1 ELSE 0 END AS isPrivate,
    (
      SELECT COUNT(*)
      FROM room_participants rp
      WHERE rp.room_id = r.id
        AND rp.left_at IS NULL
    ) AS currentPlayers
  FROM rooms r
`;

export async function createRoomWithHost(input) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await connection.query(
      `INSERT INTO rooms (
         title,
         status,
         mode,
         game_mode,
         difficulty,
         language,
         password,
         problem_count,
         max_players,
         host_user_id
       )
       VALUES (?, 'WAITING', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.mode,
        input.gameMode,
        input.difficulty,
        input.language,
        input.passwordHash,
        input.problemCount,
        input.maxPlayers,
        input.hostUserId,
      ],
    );

    const roomId = Number(result.insertId);

    await connection.query(
      `INSERT INTO room_participants (
         room_id,
         user_id,
         slot_index,
         is_host,
         is_ready,
         language,
         \`character\`,
         status
       )
       VALUES (?, ?, 0, TRUE, FALSE, ?, 'char1', 'HOST')`,
      [roomId, input.hostUserId, input.language],
    );

    await connection.commit();
    return findRoomById(roomId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findRooms() {
  return pool.query(
    `${ROOM_SELECT}
     WHERE r.status <> 'CLOSED'
     ORDER BY r.created_at DESC, r.id DESC`,
  );
}

export async function findRoomById(roomId) {
  const rows = await pool.query(
    `${ROOM_SELECT}
     WHERE r.id = ?
       AND r.status <> 'CLOSED'
     LIMIT 1`,
    [roomId],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export async function findRoomWithPassword(roomId) {
  const rows = await pool.query(
    `SELECT
       id,
       title,
       status,
       mode,
       game_mode AS gameMode,
       difficulty,
       language,
       password AS passwordHash,
       problem_count AS problemCount,
       max_players AS maxPlayers,
       host_user_id AS hostUserId,
       created_at AS createdAt
     FROM rooms
     WHERE id = ?
     LIMIT 1`,
    [roomId],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export async function findRoomParticipants(roomId) {
  return pool.query(
    `SELECT
       rp.id,
       rp.user_id AS userId,
       u.display_name AS displayName,
       rp.slot_index AS slotIndex,
       rp.is_host AS isHost,
       rp.is_ready AS isReady,
       rp.language,
       rp.\`character\` AS \`character\`,
       rp.status,
       rp.joined_at AS joinedAt
     FROM room_participants rp
     JOIN users u ON u.id = rp.user_id
     WHERE rp.room_id = ?
       AND rp.left_at IS NULL
     ORDER BY rp.slot_index ASC`,
    [roomId],
  );
}

export async function addRoomParticipant(input) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const roomRows = await connection.query(
      `SELECT id, status, max_players AS maxPlayers
       FROM rooms
       WHERE id = ?
       FOR UPDATE`,
      [input.roomId],
    );

    if (roomRows.length === 0) {
      await connection.rollback();
      return { success: false, reason: "ROOM_NOT_FOUND" };
    }

    const room = roomRows[0];

    if (room.status !== "WAITING") {
      await connection.rollback();
      return { success: false, reason: "ROOM_ALREADY_STARTED" };
    }

    const existingRows = await connection.query(
      `SELECT id
       FROM room_participants
       WHERE room_id = ?
         AND user_id = ?
         AND left_at IS NULL
       LIMIT 1`,
      [input.roomId, input.userId],
    );

    if (existingRows.length > 0) {
      await connection.rollback();
      return { success: false, reason: "ROOM_ALREADY_JOINED" };
    }

    const activeParticipants = await connection.query(
      `SELECT slot_index AS slotIndex
       FROM room_participants
       WHERE room_id = ?
         AND left_at IS NULL
       ORDER BY slot_index ASC`,
      [input.roomId],
    );

    if (activeParticipants.length >= Number(room.maxPlayers)) {
      await connection.rollback();
      return { success: false, reason: "ROOM_FULL" };
    }

    const occupiedSlots = new Set(
      activeParticipants.map((participant) => Number(participant.slotIndex)),
    );
    let slotIndex = 0;

    while (occupiedSlots.has(slotIndex)) {
      slotIndex += 1;
    }

    await connection.query(
      `INSERT INTO room_participants (
         room_id,
         user_id,
         slot_index,
         is_host,
         is_ready,
         language,
         \`character\`,
         status
       )
       VALUES (?, ?, ?, FALSE, FALSE, ?, ?, 'WAITING')`,
      [input.roomId, input.userId, slotIndex, input.language, input.character],
    );

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function leaveRoomAndSelectRandomHost(roomId, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const roomRows = await connection.query(
      `SELECT id, host_user_id AS hostUserId
       FROM rooms
       WHERE id = ?
       FOR UPDATE`,
      [roomId],
    );

    if (roomRows.length === 0) {
      await connection.rollback();
      return { success: false, reason: "ROOM_NOT_FOUND" };
    }

    const participantRows = await connection.query(
      `SELECT id, is_host AS isHost
       FROM room_participants
       WHERE room_id = ?
         AND user_id = ?
         AND left_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [roomId, userId],
    );

    if (participantRows.length === 0) {
      await connection.rollback();
      return { success: false, reason: "ROOM_NOT_JOINED" };
    }

    const participant = participantRows[0];

    await connection.query(
      `UPDATE room_participants
       SET left_at = CURRENT_TIMESTAMP,
           is_host = FALSE,
           is_ready = FALSE,
           status = 'LEFT'
       WHERE id = ?`,
      [participant.id],
    );

    let newHostUserId = null;
    let roomClosed = false;

    if (Boolean(participant.isHost)) {
      const nextHostRows = await connection.query(
        `SELECT id, user_id AS userId
         FROM room_participants
         WHERE room_id = ?
           AND left_at IS NULL
         ORDER BY RAND()
         LIMIT 1
         FOR UPDATE`,
        [roomId],
      );

      if (nextHostRows.length === 0) {
        await connection.query(
          `UPDATE rooms
           SET status = 'CLOSED'
           WHERE id = ?`,
          [roomId],
        );
        roomClosed = true;
      } else {
        const nextHost = nextHostRows[0];
        newHostUserId = nextHost.userId;

        await connection.query(
          "UPDATE rooms SET host_user_id = ? WHERE id = ?",
          [newHostUserId, roomId],
        );
        await connection.query(
          `UPDATE room_participants
           SET is_host = TRUE,
               is_ready = FALSE,
               status = 'HOST'
           WHERE id = ?`,
          [nextHost.id],
        );
      }
    }

    let currentPlayers = 0;

    if (!roomClosed) {
      const countRows = await connection.query(
        `SELECT COUNT(*) AS count
         FROM room_participants
         WHERE room_id = ?
           AND left_at IS NULL`,
        [roomId],
      );
      currentPlayers = Number(countRows[0].count);
    }

    await connection.commit();

    return {
      success: true,
      roomClosed,
      newHostUserId,
      currentPlayers,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function closeRoom(roomId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await connection.query(
      `UPDATE rooms
       SET status = 'CLOSED'
       WHERE id = ?
         AND status = 'WAITING'`,
      [roomId],
    );

    if (Number(result.affectedRows) === 0) {
      await connection.rollback();
      return false;
    }

    await connection.query(
      `UPDATE room_participants
       SET left_at = COALESCE(left_at, CURRENT_TIMESTAMP),
           is_host = FALSE,
           is_ready = FALSE,
           status = 'LEFT'
       WHERE room_id = ?
         AND left_at IS NULL`,
      [roomId],
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markRoomStarted(roomId) {
  const result = await pool.query(
    `UPDATE rooms
     SET status = 'STARTED'
     WHERE id = ?
       AND status = 'WAITING'`,
    [roomId],
  );

  return Number(result.affectedRows) > 0;
}

// 방 생성 중 Valkey 저장이 실패한 경우에만 미완성 기록을 완전히 정리합니다.
export async function hardDeleteRoom(roomId) {
  const result = await pool.query("DELETE FROM rooms WHERE id = ?", [roomId]);

  return Number(result.affectedRows) > 0;
}
