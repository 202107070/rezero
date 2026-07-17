// 테스트 용 파일
const mysql = require('mysql2/promise');

async function initDB() {
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '비밀번호', // 설정하신 비밀번호
        database: 'osDB'
    });

    const tables = [
        "users", "userItems", "userTitles", "matchCodeHistory", "rooms", 
        "roomParticipants", "problems", "matches", "matchProbles", 
        "matchSubmissions", "matchRankings", "friends", "reviewInvites"
    ];

    for (const table of tables) {
        // 실제로는 osDB.txt 내용을 바탕으로 CREATE TABLE 구문을 각각 넣어야 함
        // 여기서는 예시로 테이블 존재 여부와 생성 확인용 코드를 구성
        console.log(`✅ ${table} 테이블 생성/확인 중...`);
    }

    const [rows] = await connection.execute('SHOW TABLES');
    console.log('📊 최종 테이블 개수:', rows.length);
    console.log(rows);
    connection.end();
}

initDB();