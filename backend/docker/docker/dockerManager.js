import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateRoomId(roomId) {
  if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(roomId)) {
    throw new Error(`invalid roomId: ${roomId}`);
  }

  return roomId;
}

function validateAllocatedPort(allocatedPort) {
  const port = Number(allocatedPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid allocatedPort: ${allocatedPort}`);
  }

  return port;
}

export const gameRoomBuilder = {
  async createRoomContainer(roomId, allocatedPort) {
    const safeRoomId = validateRoomId(roomId);
    const safeAllocatedPort = validateAllocatedPort(allocatedPort);
    const containerName = `gameroom_container_${safeRoomId}`;
    const hostDbPath = path.resolve(__dirname, "../share/gameroom_dbs", safeRoomId);
    console.log(
      `new game room container creation --> roomId : ${safeRoomId}, allocatedPort : ${safeAllocatedPort}, containerName : ${containerName}`,
    );

    try {
      const runCmd = `
                podman run -d \
                --name ${containerName} \
                -p ${safeAllocatedPort}:4000 \
                -v ${hostDbPath}:/usr/src/gameroom/db:rw \
                gameroom-base-image
            `;

      await execAsync(runCmd);
      console.log(
        `gameroom container created successfully --> roomId : ${safeRoomId}, allocatedPort : ${safeAllocatedPort}, containerName : ${containerName} `,
      );
      return { success: true, containerName };
    } catch (error) {
      console.error(`Error creating gameroom container --> roomId : ${safeRoomId}, allocatedPort : ${safeAllocatedPort}, containerName : ${containerName}`, error.message);
      return { success: false, error: error.message };
    }
  },

  async destroyRoomContainer(roomId) {
    const safeRoomId = validateRoomId(roomId);
    const containerName = `gameroom_container_${safeRoomId}`;
    console.log(
      `room container destruction --> roomId : ${safeRoomId}, containerName : ${containerName}`,
    );

    try {
      await execAsync(`podman stop ${containerName}`);
      await execAsync(`podman rm ${containerName}`);
      console.log(`room container destroyed successfully --> roomId : ${safeRoomId}, containerName : ${containerName}`);
    } catch (error) {
      console.error(
        `room container destruction error --> roomId : ${safeRoomId}, containerName : ${containerName}`,
        error.message,
      );
    }
  },
};