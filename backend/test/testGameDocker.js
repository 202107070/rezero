import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import { gameService } from "#docker/service/gameService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";
import { fileService } from "#docker/service/fileService.js";

async function runGameDockerTest() {
  console.log("==================================================");
  console.log(" [Test] DB-Integrated Game Docker & Sandbox Engine");
  console.log("==================================================");

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    // 1. 데이터베이스에서 방 및 문제 데이터 조회
    console.log("\n[-] Fetching test room and problem data from Database...");
    
    const rooms = await dbPool.query(
      "SELECT id, title, status, game_mode, difficulty, language, problem_count, max_players, host_user_id FROM rooms WHERE status = 'WAITING' LIMIT 1"
    );

    if (!rooms || rooms.length === 0) {
      console.log(" [Aborted] No WAITING rooms found in the database.");
      return;
    }

    const roomData = rooms[0];
    const testRoomId = String(roomData.id);
    const testUserId = String(roomData.host_user_id);
    const testMatchId = "battle-" + testRoomId;
    const testProblemId = "prob_101";

    const participants = await dbPool.query(
      "SELECT user_id FROM room_participants WHERE room_id = ?",
      [roomData.id]
    );
    
    const participantIds = [];
    for (let i = 0; i < participants.length; i++) {
      participantIds.push(String(participants[i].user_id));
    }
    
    if (participantIds.length === 0) {
      participantIds.push(testUserId);
    }

    const problems = await dbPool.query(
      "SELECT id, type, difficulty, title, question, options, description FROM problems WHERE id = ?",
      [testProblemId]
    );
    
    let problemRecord;
    if (problems.length > 0) {
      problemRecord = problems[0];
    } else {
      problemRecord = {
        id: testProblemId,
        type: "CHOICE",
        difficulty: "easy",
        title: "두 수의 합 구하기",
        question: "1 + 1의 결과는?",
        options: JSON.stringify(["1", "2", "3", "4"]),
        description: "기초 산수 문제"
      };
    }

    console.log(" DB Data Fetched -> Room ID: " + testRoomId + " | Host: " + testUserId);

    // 2. Valkey(Redis) 데이터 시딩
    console.log("\n[-] Seeding room & participant data into Valkey...");
    const roomStateKey = "room:" + testRoomId + ":state";
    const participantsKey = "room:" + testRoomId + ":participants";

    let gameModeValue = roomData.game_mode;
    if (!gameModeValue) {
      gameModeValue = "normal";
    }

    let difficultyValue = roomData.difficulty;
    if (!difficultyValue) {
      difficultyValue = "EASY";
    }

    let languageValue = roomData.language;
    if (!languageValue) {
      languageValue = "PYTHON";
    }

    let problemCountValue = roomData.problem_count;
    if (!problemCountValue) {
      problemCountValue = 3;
    }

    let maxPlayersValue = roomData.max_players;
    if (!maxPlayersValue) {
      maxPlayersValue = 2;
    }

    await redisClient.hSet(roomStateKey, {
      roomId: testRoomId,
      title: roomData.title,
      status: roomData.status,
      gameMode: gameModeValue,
      difficulty: difficultyValue,
      language: languageValue,
      problemCount: String(problemCountValue),
      maxPlayers: String(maxPlayersValue),
      hostUserId: testUserId
    });

    await redisClient.del(participantsKey);
    await redisClient.sAdd(participantsKey, participantIds);
    console.log(" Valkey Seeding Complete.");

    // 3. Valkey 상태 확인
    console.log("\n[-] Loading room settings and participants from Valkey...");
    const loadedRoomState = await redisClient.hGetAll(roomStateKey);
    const loadedParticipants = await redisClient.sMembers(participantsKey);

    console.log("   • Room State:", loadedRoomState);
    console.log("   • Participants:", loadedParticipants);

    // 4. 배틀 초기화 락 확인
    console.log("\n[-] Checking battle initialization lock...");
    const lockKey = "lock:battle:init:" + testRoomId;
    const acquiredLock = await redisClient.set(lockKey, "LOCKED", {
      NX: true,
      EX: 10
    });

    if (!acquiredLock) {
      console.log(" [Blocked] Battle initialization for room [" + testRoomId + "] is already in progress or completed.");
      return;
    }
    console.log(" Lock acquired successfully.");

    // 5. 매치 상태 초기화
    console.log("\n[-] Initializing match state in Valkey...");
    const matchStateKey = "match:" + testMatchId + ":state";

    const matchInitData = {
      matchId: testMatchId,
      roomId: testRoomId,
      selectedProblemId: testProblemId,
      currentProblemIndex: "0",
      roundSeconds: "180",
      gameStatus: "INITIALIZED",
      initializedAt: new Date().toISOString()
    };

    await redisClient.hSet(matchStateKey, matchInitData);
    const loadedMatchState = await redisClient.hGetAll(matchStateKey);
    console.log(" Match State Initialized:", loadedMatchState);

    // 6. 게임 시작 브로드캐스트 페이로드 구성
    console.log("\n[-] Preparing game start payload...");
    
    let parsedOptions = problemRecord.options;
    if (typeof parsedOptions === 'string') {
      try {
        parsedOptions = JSON.parse(parsedOptions);
      } catch (e) {
        // parsing failed
      }
    }

    const problemDataForClient = {
      id: problemRecord.id,
      type: problemRecord.type,
      difficulty: problemRecord.difficulty,
      title: problemRecord.title,
      question: problemRecord.question,
      options: parsedOptions,
      description: problemRecord.description
    };

    const gameStartPayload = {
      matchId: testMatchId,
      roomId: testRoomId,
      problem: problemDataForClient,
      duration: 180,
      status: "STARTED"
    };

    console.log("   • Target Room: [" + testRoomId + "]");
    console.log("   • Socket Payload:", gameStartPayload);

    // 7. 베이스 이미지 빌드 테스트
    console.log("\n[1/4] Testing base image build...");
    const buildResult = await gameService.buildBaseImage();
    
    let buildResultStr;
    if (buildResult.success) {
      buildResultStr = "SUCCESS";
    } else {
      buildResultStr = "FAILED";
    }
    console.log(" Build Result: " + buildResultStr);

    // 8. Python 코드 제출 및 실행 테스트
    console.log("\n[2/4] Testing Python Code Submission & Execution...");
    const pythonCode = "print('Hello from Python Sandbox Game Engine!')";

    await gameService.processCodeSubmission({
      submissionId: 1001,
      userId: testUserId,
      language: "python",
      code: pythonCode,
      roomId: testRoomId,
    });

    const pyResult = await gameWorker.processSubmission({
      submissionId: 1001,
      userId: testUserId,
      language: "python",
      roomId: testRoomId,
    });

    console.log(" Python Execution Result:", pyResult);

    // 9. C++ 코드 컴파일 및 실행 테스트
    console.log("\n[3/4] Testing C++ Code Compilation & Execution...");
    const cppCode = "#include <iostream>\nint main() {\n    std::cout << \"Hello C++ Engine\" << std::endl;\n    return 0;\n}";

    await gameService.processCodeSubmission({
      submissionId: 1002,
      userId: testUserId,
      language: "cpp",
      code: cppCode,
      roomId: testRoomId,
    });

    const cppResult = await gameWorker.processSubmission({
      submissionId: 1002,
      userId: testUserId,
      language: "cpp",
      roomId: testRoomId,
    });

    console.log(" C++ Execution Result:", cppResult);

    // 10. 샌드박스 파일 정리
    console.log("\n[4/4] Cleaning up sandbox files...");
    await fileService.deleteSourceCode(testUserId, "python");
    await fileService.deleteSourceCode(testUserId, "cpp");
    console.log(" Cleanup complete.");

    console.log("\n Game Docker Engine Test Completed Successfully!\n");
  } catch (error) {
    console.error("\n Game Docker Test Failed:", error);
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  }
}

runGameDockerTest();