// src/manageRoom/manageRoomService.js
import { pool } from "../config/dbConfig.js";
import { ManageRoomDto } from "./manageRoomDto.js";
import { DEFAULT_ROOM_LIMIT } from "./manageRoomConfig.js";

class ManageRoomService {
  async getRooms(limit = DEFAULT_ROOM_LIMIT) {
    // limit 값을 확실히 정수(Integer)로 변환
    const parsedLimit = parseInt(limit, 10) || DEFAULT_ROOM_LIMIT;

    // LIMIT ? 파라미터 바인딩 대신 안전하게 숫자 값을 직접 템플릿 리터럴로 대입
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

      // mysql2 / knex / custom poolwrapper 등 다양한 반환 형태 대응
      // 1) [rows, fields] 구조인 경우: Array.isArray(result[0])
      // 2) result 자체가 rows 배열인 경우: Array.isArray(result)
      let rows = [];
      if (Array.isArray(result[0])) {
        rows = result[0];
      } else if (Array.isArray(result)) {
        rows = result;
      }

      // 안전하게 DTO 변환
      return rows.map((row) => new ManageRoomDto(row).toJSON());
    } catch (error) {
      console.error("[ManageRoomService] getRooms Error:", error);
      throw error;
    }
  }
}

export default new ManageRoomService();
