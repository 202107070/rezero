// src/handler/socketHandler.js

import {
  validateJoinRoom,
  validateSendMessage,
  validateReadyChange,
  validateSubmitCode,
  validateUseItem,
} from "#dto/socketDto.js";
import {
  saveAndFormatMessage,
  getRecentMessages,
  saveReadyState,
  socketGameService,
} from "#service/socketService.js";
import gameStartService from "#service/manageGameService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";

export function registerSocketHandlers(io, socket) {
  console.log(
    "[Socket 연결 완료] " + socket.user.displayName + " (" + socket.id + ")",
  );

  socket.on(SOCKET_EVENTS.JOIN_ROOM, async function (data, callback) {
    try {
      const validatedRoom = validateJoinRoom(data);
      const roomId = validatedRoom.roomId;

      socket.join(roomId);
      console.log(
        socket.user.displayName + " 님이 [" + roomId + "] 방에 입장함",
      );

      // Valkey에서 게임 진행 상태 확인 후 재접속 복원 처리
      const roomStateKey = "room:" + roomId + ":state";
      const roomState = await redisClient.hGetAll(roomStateKey);

      if (
        roomState &&
        (roomState.status === "IN_GAME" || roomState.status === "STARTED")
      ) {
        console.log(
          "[재접속 복원] " +
            socket.user.displayName +
            " 님이 진행 중인 게임에 재접속했습니다.",
        );
        socket.emit(SOCKET_EVENTS.USER_RECONNECTED, {
          roomId: roomId,
          matchId: roomState.matchId,
          status: roomState.status,
          currentProblemIndex: roomState.currentProblemIndex,
          timeLimit: roomState.timeLimit,
          language: roomState.language,
          difficulty: roomState.difficulty,
          problemId: roomState.problemId,
        });
      }

      const recentMessages = await getRecentMessages(roomId);

      socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, {
        message: socket.user.displayName + " 님이 입장하셨습니다.",
        user: socket.user,
      });

      if (typeof callback === "function") {
        callback({ success: true, recentMessages: recentMessages });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async function (data, callback) {
    try {
      const validatedData = validateSendMessage(data);

      const chatMessage = await saveAndFormatMessage({
        roomId: validatedData.roomId,
        sender: socket.user,
        message: validatedData.message,
      });

      io.to(validatedData.roomId).emit(
        SOCKET_EVENTS.RECEIVE_MESSAGE,
        chatMessage,
      );

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      socket.emit(SOCKET_EVENTS.CHAT_ERROR, { message: error.message });
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.TOGGLE_READY, async function (data, callback) {
    try {
      const validatedData = validateReadyChange(data);
      const readyState = await saveReadyState({
        roomId: validatedData.roomId,
        userId: socket.user.id,
        isReady: validatedData.isReady,
      });

      io.to(validatedData.roomId).emit(SOCKET_EVENTS.READY_CHANGED, readyState);

      if (typeof callback === "function") {
        callback({ success: true, readyState: readyState });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.REQUEST_GAME_START, async function (data, callback) {
    try {
      let roomId = null;
      if (data && data.roomId) {
        roomId = String(data.roomId);
      }

      if (!roomId) {
        throw new Error("유효한 roomId가 필요합니다.");
      }

      const startResult = await gameStartService.checkCanStart(roomId, io);

      if (!startResult.canStart) {
        if (typeof callback === "function") {
          callback({
            success: false,
            message: startResult.reason,
            data: startResult,
          });
        }
        return;
      }

      if (typeof callback === "function") {
        callback({ success: true, data: startResult });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.SUBMIT_CODE, async function (data, callback) {
    try {
      const validated = validateSubmitCode(data);

      const submission = {
        userId: socket.user.id,
        roomId: validated.roomId,
        language: validated.language,
        code: validated.code,
      };

      const compileResult = await gameWorker.processSubmission(submission);

      let isCorrect = false;
      if (compileResult && compileResult.success === true) {
        isCorrect = true;
      }

      const execResult = {
        stdout: compileResult.stdout || "",
        stderr: compileResult.stderr || "",
        executionTime: (compileResult.executionTime || 0) + "ms",
      };

      let questionData = { id: validated.questionId };
      if (validated.questionId) {
        const probRows = await dbPool.query(
          "SELECT id, title FROM problems WHERE id = ?",
          [validated.questionId],
        );
        if (probRows && probRows.length > 0) {
          questionData = {
            id: probRows[0].id,
            title: probRows[0].title,
          };
        }
      }

      const currentScores = [
        {
          userId: socket.user.id,
          score: compileResult.score || (isCorrect ? 100 : 0),
        },
      ];

      const currentSubmitStatuses = [
        {
          userId: socket.user.id,
          isSubmitted: true,
        },
      ];

      socketGameService.sendExecutionResult(socket, {
        userId: socket.user.id,
        executionResult: execResult,
        isCorrect: isCorrect,
      });

      socketGameService.broadcastGameState(io, validated.roomId, {
        roomId: validated.roomId,
        question: questionData,
        remainingTime: 120,
        scores: currentScores,
        submitStatuses: currentSubmitStatuses,
      });

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.USE_ITEM, async function (data, callback) {
    try {
      const validated = validateUseItem(data);

      let targetUserId = validated.targetUserId;
      let targetDisplayName = "상대방";

      if (targetUserId) {
        const userRows = await dbPool.query(
          "SELECT display_name FROM users WHERE id = ?",
          [targetUserId],
        );
        if (userRows && userRows.length > 0) {
          targetDisplayName = userRows[0].display_name;
        }
      }

      const effectMessage =
        socket.user.displayName +
        "님이 " +
        (targetUserId ? targetDisplayName + "님에게 " : "") +
        "아이템 [" +
        validated.itemType +
        "]을 사용했습니다.";

      socketGameService.broadcastItemUsed(io, validated.roomId, {
        fromUserId: socket.user.id,
        targetUserId: targetUserId,
        itemType: validated.itemType,
        success: true,
        effectDetails: effectMessage,
      });

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(
    SOCKET_EVENTS.REQUEST_NEXT_QUESTION,
    async function (data, callback) {
      try {
        if (!data || !data.roomId) {
          throw new Error("roomId가 누락되었습니다.");
        }

        const roomId = String(data.roomId);
        const nextIndex = data.questionIndex
          ? Number(data.questionIndex) + 1
          : 2;

        let nextQuestion = null;

        try {
          const rawList = await redisClient.get("room:" + roomId + ":problems");
          if (rawList) {
            const parsedList = JSON.parse(rawList);
            if (Array.isArray(parsedList) && parsedList.length > 0) {
              const randomIndex = Math.floor(Math.random() * parsedList.length);
              nextQuestion = parsedList[randomIndex];
            }
          }
        } catch (e) {}

        if (!nextQuestion) {
          const randRows = await dbPool.query(
            "SELECT id, title FROM problems ORDER BY RAND() LIMIT 1",
          );

          if (randRows && randRows.length > 0) {
            nextQuestion = {
              id: randRows[0].id,
              title: randRows[0].title,
              content: randRows[0].title + " 문제 내용입니다.",
            };
          }
        }

        const nextQuestionData = {
          roomId: roomId,
          question: nextQuestion,
          timeLimit: 120,
          questionIndex: nextIndex,
        };

        socketGameService.broadcastNextQuestion(io, roomId, nextQuestionData);

        if (typeof callback === "function") {
          callback({ success: true, question: nextQuestion });
        }
      } catch (error) {
        if (typeof callback === "function") {
          callback({ success: false, message: error.message });
        }
      }
    },
  );

  socket.on("disconnect", function () {
    console.log(
      "[Socket 연결 종료] " +
        socket.user.displayName +
        " - Valkey 데이터는 유지됩니다.",
    );
  });
}
