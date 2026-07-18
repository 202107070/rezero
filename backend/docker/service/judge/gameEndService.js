import fs from "fs/promises";
import path from "path";
import { CONTAINER_CONFIG } from "../../docker/contaienrConfig.js";

const SANDBOX_PATH = CONTAINER_CONFIG.containerSandboxPath;
const RESULTBOX_PATH = CONTAINER_CONFIG.containerResultboxPath;

async function saveFinalResult(matchingRoomId, userId, compileResult) {
    const finalResultFileName = `final_${matchingRoomId}_${userId}_${Date.now()}.json`;
    const finalResultPath = path.join(RESULTBOX_PATH, finalResultFileName);

    await fs.writeFile(
        finalResultPath,
        JSON.stringify(
            {
                matchingRoomId,
                userId,
                compileResult,
                savedAt: new Date().toISOString(),
            },
            null,
            2,
        ),
        "utf-8",
    );

    console.log(`final result saved: ${finalResultFileName}`);
}

export const gameEndService = {
    async processGameEnd(matchingRoomId, userIds) {
        try {
            console.log("game end service --> start cleaning sandbox and resultbox");

            const resultFiles = await fs.readdir(RESULTBOX_PATH);
            for (const userId of userIds) {
                const userResultFiles = resultFiles.filter((file) => file.startsWith(`${userId}`));
                for (const fileName of userResultFiles) {
                    const filePath = path.join(RESULTBOX_PATH, fileName);
                    try {
                        const fileStat = await fs.stat(filePath);
                        const compileResult = `check game end result, file size : ${fileStat.size} bytes`;

                        await saveFinalResult(matchingRoomId, userId, compileResult);

                        await fs.unlink(filePath);
                        console.log(`resultbox file deleted: ${fileName}`);
                    } catch (e) {
                        console.error(`Error processing resultbox file ${fileName}:`, e.message);
                    }
                }
            }

            const sandboxFiles = await fs.readdir(SANDBOX_PATH);
            for (const userId of userIds) {
                const userSandboxFiles = sandboxFiles.filter((file) => file.startsWith(`${userId}`));
                for (const srcFile of userSandboxFiles) {
                    const srcFilePath = path.join(SANDBOX_PATH, srcFile);
                    try {
                        await fs.unlink(srcFilePath);
                        console.log(`sandbox file deleted: ${srcFile}`);
                    } catch (srcErr) {
                        console.error('error deleting file in sandbox: ', srcErr.message);
                    }
                }
            }

            console.log(`gameroom ${matchingRoomId} and all processed remove complete`);

        } catch (err) {
            console.error("Error during game end processing:", err.message);
            throw err;
        }
    },
};
