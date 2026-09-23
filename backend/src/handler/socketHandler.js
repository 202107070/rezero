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
  saveReadyState,
  socketGameService,
  markUserOnline,
  markUserOffline,
  broadcastLobbyPresence,
  listOnlineUsers,
  updateUserLocation,
  LOBBY_ROOM_ID,
} from "#service/socketService.js";
import gameStartService from "#service/manageGameService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";
import { pool as dbPool } from "#config/dbConfig.js";
import { redisClient } from "#config/redisConfig.js";
import * as roomModel from "../api/room/model.js";

function userLabel(user) {
  const display = String(user?.displayName || "").trim();
  const username = String(user?.username || "").trim();
  // displayName이 username과 같으면 그냥 표시, 다르면 displayName 우선
  if (display) return display;
  if (username) return username;
  return user?.id || "USER";
}

export function registerSocketHandlers(io, socket) {
  console.log("[Socket 연결 완료] " + userLabel(socket.user) + " (" + socket.id + ")");
  // 개인 룸: 친구 요청 등 1:1 이벤트용
  socket.join("user:" + String(socket.user.id));
  void markUserOnline(socket.user).then(function () {
    return broadcastLobbyPresence(io);
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, async function (data, callback) {
    try {
      const validatedRoom = validateJoinRoom(data);
      const roomId = validatedRoom.roomId;

      if (roomId === LOBBY_ROOM_ID) {
        // 로비 입장 시 게임방 소켓 룸에서 나와야 로비 채팅이 양쪽에 보임
        for (const joined of socket.rooms) {
          if (joined !== socket.id && joined !== LOBBY_ROOM_ID && !String(joined).startsWith("user:")) {
            socket.leave(joined);
          }
        }
      } else if (roomId !== LOBBY_ROOM_ID) {
        socket.leave(LOBBY_ROOM_ID);
      }

      socket.join(roomId);
      console.log(userLabel(socket.user) + " 님이 [" + roomId + "] 방에 입장함");

      if (roomId === LOBBY_ROOM_ID) {
        await updateUserLocation(socket.user, {
          location: "lobby",
          roomId: "",
          roomTitle: "",
        });
        await broadcastLobbyPresence(io);
        if (typeof callback === "function") {
          callback({
            success: true,
            recentMessages: [],
            onlineUsers: await listOnlineUsers(),
          });
        }
        return;
      }

      // 숫자 방이면 대기방 위치로 표시
      if (/^\d+$/.test(String(roomId))) {
        let roomTitle = "";
        try {
          const room = await roomModel.findRoomById(roomId);
          roomTitle = room?.title ? String(room.title) : `${roomId}번 방`;
        } catch {
          roomTitle = `${roomId}번 방`;
        }
        await updateUserLocation(socket.user, {
          location: "room",
          roomId: String(roomId),
          roomTitle,
        });
        await broadcastLobbyPresence(io);
      }

      // Valkey에서 게임 진행 상태 확인 후 재접속 복원 처리
      // STARTED만으로는 배틀 진입 join과 구분되지 않으므로 IN_GAME 만 재접속으로 취급
      const roomStateKey = "room:" + roomId + ":state";
      const roomState = await redisClient.hGetAll(roomStateKey);

      if (roomState && roomState.status === "IN_GAME") {
        console.log(
          "[재접속 복원] " +
            userLabel(socket.user) +
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

      socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, {
        message: userLabel(socket.user) + " 님이 입장하셨습니다.",
        user: {
          id: socket.user.id,
          username: socket.user.username,
          displayName: userLabel(socket.user),
        },
      });

      if (typeof callback === "function") {
        callback({ success: true, recentMessages: [] });
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
        mode: validatedData.mode,
        targetUserId: validatedData.targetUserId,
        targetUserName: validatedData.targetUserName,
      });

      if (validatedData.mode === "WHISPER" && validatedData.targetUserId) {
        const targetRoom = "user:" + String(validatedData.targetUserId);
        io.to(targetRoom).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, chatMessage);
        socket.emit(SOCKET_EVENTS.RECEIVE_MESSAGE, chatMessage);
      } else if (validatedData.mode === "FRIEND") {
        const friendIds = validatedData.friendUserIds || [];
        const delivered = new Set();
        for (let i = 0; i < friendIds.length; i++) {
          const fid = String(friendIds[i]);
          if (delivered.has(fid)) continue;
          delivered.add(fid);
          io.to("user:" + fid).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, chatMessage);
        }
        // 방 전체 브로드캐스트 금지 — 친구 목록 대상에게만 전달
        socket.emit(SOCKET_EVENTS.RECEIVE_MESSAGE, chatMessage);
      } else {
        io.to(validatedData.roomId).emit(
          SOCKET_EVENTS.RECEIVE_MESSAGE,
          chatMessage,
        );
      }

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
        scribbleStroke: validated.scribbleStroke || null,
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

  socket.on(SOCKET_EVENTS.REVIEW_INVITE, function (data, callback) {
    try {
      const roomId = data?.roomId ? String(data.roomId) : "";
      const toUserIds = Array.isArray(data?.toUserIds)
        ? data.toUserIds.map(String)
        : data?.toUserId
          ? [String(data.toUserId)]
          : [];
      if (!roomId || toUserIds.length === 0) {
        throw new Error("리뷰 초대 대상이 없습니다.");
      }
      const payload = {
        id: data.id || "review-" + Date.now(),
        roomId,
        matchId: data.matchId || null,
        sessionId: data.sessionId || null,
        fromUserId: String(socket.user.id),
        fromUserName: userLabel(socket.user),
        toUserIds,
        problemIndices: Array.isArray(data.problemIndices) ? data.problemIndices : [],
        problems: Array.isArray(data.problems) ? data.problems : [],
        createdAt: Date.now(),
      };
      io.to(roomId).emit(SOCKET_EVENTS.REVIEW_INVITE, payload);
      if (typeof callback === "function") {
        callback({ success: true, invite: payload });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.REVIEW_INVITE_RESPONSE, function (data, callback) {
    try {
      const roomId = data?.roomId ? String(data.roomId) : "";
      if (!roomId) throw new Error("roomId가 필요합니다.");
      const payload = {
        inviteId: data.inviteId || data.id,
        roomId,
        fromUserId: data.fromUserId,
        toUserId: String(socket.user.id),
        toUserName: userLabel(socket.user),
        accepted: Boolean(data.accepted),
        problemIndices: Array.isArray(data.problemIndices) ? data.problemIndices : [],
      };
      io.to(roomId).emit(SOCKET_EVENTS.REVIEW_INVITE_RESPONSE, payload);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.UPDATE_CHARACTER, async function (data, callback) {
    try {
      const roomId = data?.roomId ? String(data.roomId) : "";
      const character = data?.character ? String(data.character).trim() : "";
      if (!roomId || !character) {
        throw new Error("roomId와 character가 필요합니다.");
      }
      const roomModel = await import("../api/room/model.js");
      const updated = await roomModel.updateParticipantCharacter(
        Number(roomId),
        socket.user.id,
        character,
      );
      if (!updated) {
        throw new Error("캐릭터를 변경할 수 없습니다.");
      }
      const payload = {
        roomId,
        userId: String(socket.user.id),
        character,
      };
      io.to(roomId).emit(SOCKET_EVENTS.CHARACTER_CHANGED, payload);
      if (typeof callback === "function") {
        callback({ success: true, ...payload });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.FRIEND_REQUEST, async function (data, callback) {
    try {
      const toUserId = data?.toUserId ? String(data.toUserId) : "";
      if (!toUserId) throw new Error("친구 요청 대상이 없습니다.");
      if (toUserId === String(socket.user.id)) {
        throw new Error("자기 자신에게 친구 요청을 보낼 수 없습니다.");
      }
      const payload = {
        fromUserId: String(socket.user.id),
        fromUserName: userLabel(socket.user),
        fromUsername: socket.user.username || "",
        toUserId,
        toUserName: data?.toUserName || "",
        createdAt: Date.now(),
      };
      io.to("user:" + toUserId).emit(SOCKET_EVENTS.FRIEND_REQUEST, payload);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.FRIEND_REQUEST_RESULT, function (data, callback) {
    try {
      const toUserId = data?.toUserId ? String(data.toUserId) : "";
      if (!toUserId) throw new Error("응답 대상이 없습니다.");
      const payload = {
        fromUserId: String(socket.user.id),
        fromUserName: userLabel(socket.user),
        toUserId,
        accepted: Boolean(data?.accepted),
      };
      io.to("user:" + toUserId).emit(SOCKET_EVENTS.FRIEND_REQUEST_RESULT, payload);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.FRIEND_REMOVE, function (data, callback) {
    try {
      const toUserId = data?.toUserId ? String(data.toUserId) : "";
      if (!toUserId) throw new Error("삭제 대상이 없습니다.");
      const payload = {
        fromUserId: String(socket.user.id),
        fromUserName: userLabel(socket.user),
        toUserId,
      };
      io.to("user:" + toUserId).emit(SOCKET_EVENTS.FRIEND_REMOVE, payload);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_INVITE, async function (data, callback) {
    try {
      const toUserId = data?.toUserId ? String(data.toUserId) : "";
      const roomId = data?.roomId != null ? String(data.roomId) : "";
      if (!toUserId) throw new Error("초대 대상이 없습니다.");
      if (!roomId) throw new Error("방 정보가 없습니다.");
      const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await redisClient.set(
        `room:invite:${inviteToken}`,
        JSON.stringify({
          roomId,
          toUserId,
          fromUserId: String(socket.user.id),
        }),
        { EX: 300 },
      );
      const payload = {
        fromUserId: String(socket.user.id),
        fromUserName: userLabel(socket.user),
        toUserId,
        roomId,
        roomTitle: data?.roomTitle ? String(data.roomTitle) : "",
        roomQuery: data?.roomQuery ? String(data.roomQuery) : `id=${roomId}`,
        inviteToken,
        createdAt: Date.now(),
      };
      io.to("user:" + toUserId).emit(SOCKET_EVENTS.ROOM_INVITE, payload);
      if (typeof callback === "function") {
        callback({ success: true, inviteToken });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.UPDATE_LOCATION, async function (data, callback) {
    try {
      const location = data?.location ? String(data.location) : "lobby";
      const roomId = data?.roomId != null ? String(data.roomId) : "";
      const roomTitle = data?.roomTitle != null ? String(data.roomTitle) : "";
      const ratingScore =
        data?.ratingScore != null ? Number(data.ratingScore) : undefined;
      await updateUserLocation(socket.user, {
        location,
        roomId,
        roomTitle,
        ratingScore,
      });
      await broadcastLobbyPresence(io);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_INVITE_RESPONSE, function (data, callback) {
    try {
      const toUserId = data?.toUserId ? String(data.toUserId) : "";
      if (!toUserId) throw new Error("응답 대상이 없습니다.");
      const payload = {
        fromUserId: String(socket.user.id),
        fromUserName: userLabel(socket.user),
        toUserId,
        accepted: Boolean(data?.accepted),
        roomId: data?.roomId != null ? String(data.roomId) : "",
      };
      io.to("user:" + toUserId).emit(SOCKET_EVENTS.ROOM_INVITE_RESPONSE, payload);
      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.UPDATE_TITLE, async function (data, callback) {
    try {
      const titleId = data?.titleId != null ? String(data.titleId) : "";
      await markUserOnline({
        ...socket.user,
        equippedTitleId: titleId || "",
      });
      await broadcastLobbyPresence(io);
      const payload = {
        userId: String(socket.user.id),
        titleId: titleId || null,
        displayName: userLabel(socket.user),
      };
      io.to(LOBBY_ROOM_ID).emit(SOCKET_EVENTS.TITLE_CHANGED, payload);
      if (typeof callback === "function") {
        callback({ success: true, ...payload });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on(SOCKET_EVENTS.USER_LOGOUT, async function (data, callback) {
    try {
      await markUserOffline(socket.user?.id);
      await broadcastLobbyPresence(io);
      if (typeof callback === "function") {
        callback({ success: true });
      }
      // 명시적 로그아웃 후 소켓 종료 (disconnect 핸들러가 한 번 더 offline 처리해도 안전)
      socket.disconnect(true);
    } catch (error) {
      if (typeof callback === "function") {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on("disconnect", async function () {
    console.log(
      "[Socket 연결 종료] " +
        userLabel(socket.user) +
        " - 참가 중인 방에서 퇴장 처리합니다.",
    );

    try {
      await markUserOffline(socket.user?.id);
      await broadcastLobbyPresence(io);

      const { leaveRoom } = await import("../api/room/service.js");
      const joinedRooms = [...socket.rooms].filter(function (room) {
        return room !== socket.id && room !== LOBBY_ROOM_ID;
      });

      for (let i = 0; i < joinedRooms.length; i++) {
        const roomId = Number(joinedRooms[i]);
        if (!Number.isInteger(roomId) || roomId < 1) continue;
        try {
          // WAITING/STARTED 모두 퇴장 처리 → 유령 인원/방 잔존 방지
          await leaveRoom(roomId, socket.user.id);
        } catch (leaveError) {
          // 이미 나간 방이면 무시
        }
      }
    } catch (error) {
      console.error("[disconnect leaveRoom] " + error.message);
    }
  });
}
