import { pool } from "#config/dbConfig.js";
import { ManageRoomDto } from "#dto/manageRoomDto.js";
import { DEFAULT_ROOM_LIMIT } from "#config/manageRoomConfig.js";

class ManageRoomService {
  async getRooms(limit = DEFAULT_ROOM_LIMIT) {
    let parsedLimit = parseInt(limit, 10);
    if (!parsedLimit) {
      parsedLimit = DEFAULT_ROOM_LIMIT;
    }

    const query = `
      SELECT
        r.id,
        r.title,
        r.status,
        r.mode,
        r.game_mode,
        r.difficulty,
        r.language,
        r.password,
        r.problem_count,
        r.max_players,
        r.host_user_id,
        r.created_at,
        COUNT(rp.id) AS current_players
      FROM rooms r
      LEFT JOIN room_participants rp
        ON r.id = rp.room_id AND rp.left_at IS NULL
      GROUP BY r.id
      ORDER BY r.id ASC
      LIMIT ${parsedLimit}
    `;

    try {
      const result = await pool.query(query);

      let rows = [];
      if (Array.isArray(result[0])) {
        rows = result[0];
      } else {
        if (Array.isArray(result)) {
          rows = result;
        }
      }

      return rows.map(function (row) {
        return new ManageRoomDto(row).toJSON();
      });
    } catch (error) {
      console.error("[ManageRoomService] getRooms Error:", error);
      throw error;
    }
  }
}

export default new ManageRoomService();
