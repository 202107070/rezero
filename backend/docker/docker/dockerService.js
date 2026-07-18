// ./docker/docker/dockerService.js 경로에 생성
import { exec } from "child_process";
import fs from "fs/promises";
import { promisify } from "util";
import { CONTAINER_CONFIG } from "./contaienrConfig.js"; 
import { fileService } from "../service/file/fileService.js";

const execAsync = promisify(exec);

function validateUserId(userId) {
    if (typeof userId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
        throw new Error(`지원하지 않는 userId입니다: ${userId}`);
    }

    return userId;
}

function getLangConfig(language) {
    if (typeof language !== "string" || language.trim().length === 0) {
        throw new Error("지원하지 않는 언어입니다: empty language");
    }

    const langKey = language.toLowerCase() === "c++" ? "cpp" : language.toLowerCase();
    const config = CONTAINER_CONFIG.languages[langKey];

    if (!config) {
        throw new Error(`지원하지 않는 언어입니다: ${language}`);
    }

    return config;
}

async function removeAllFiles(targetDir) {
    try {
        const entries = await fs.readdir(targetDir);
        await Promise.all(entries.map((entry) => fs.rm(`${targetDir}/${entry}`, { recursive: true, force: true })));
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
}

export const dockerService = {
    getLangConfig(language) {
        return getLangConfig(language);
    },

    async compileCode(userId, language) {
        try {
            const safeUserId = validateUserId(userId);
            const langConfig = getLangConfig(language);
            const sourcePath = `/usr/src/sandbox/${safeUserId}.${langConfig.ext}`;
            const outputPath = `/usr/src/resultbox/${safeUserId}.out`;
            const compileCmd = `podman exec ${CONTAINER_CONFIG.containerName} ${langConfig.compiler} ${sourcePath} -o ${outputPath}`;
            const { stdout, stderr } = await execAsync(compileCmd);
            return { success: true, stdout, stderr, outputPath };
        } catch (error) {
            return { success: false, stderr: error.stderr || error.message };
        }
    },

    async runCompiledBinary(userId) {
        try {
            const safeUserId = validateUserId(userId);
            const binaryPath = `/usr/src/resultbox/${safeUserId}.out`;
            const runCmd = `podman exec ${CONTAINER_CONFIG.containerName} ${binaryPath}`;
            const { stdout, stderr } = await execAsync(runCmd);

            return { success: true, stdout, stderr };
        } catch (error) {
            return { success: false, stderr: error.stderr || error.message };
        }
    },

    async clearSandbox(userId, language) {
        const safeUserId = validateUserId(userId);

        await fileService.deleteSourceCode(safeUserId, language).catch(() => {});
        const clearCmd = `podman exec ${CONTAINER_CONFIG.containerName} rm -f /usr/src/resultbox/${safeUserId}.out`;
        await execAsync(clearCmd).catch(() => {});
    },

    async clearWorkspace() {
        await removeAllFiles(CONTAINER_CONFIG.containerSandboxPath).catch(() => {});
        await removeAllFiles(CONTAINER_CONFIG.containerResultboxPath).catch(() => {});
    },

    async stopCompilerContainer() {
        const stopCmd = `podman stop ${CONTAINER_CONFIG.containerName}`;
        await execAsync(stopCmd).catch(() => {});
    }
};