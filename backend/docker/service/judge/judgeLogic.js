import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";

const execAsync = util.promisify(exec);

function normalizeLanguage(language) {
    if (typeof language !== "string" || language.trim().length === 0) {
        throw new Error("지원하지 않는 언어입니다: empty language");
    }

    const normalized = language.toLowerCase();
    if (normalized === "c++") return "cpp";
    return normalized;
}

export async function runJudgeLogic(submission) {
    if (!submission || typeof submission !== "object") {
        throw new Error("submission is required");
    }

    const { submissionId, code } = submission;
    const language = normalizeLanguage(submission.language);

    console.log(`runJudgeLogic start --> submissionId : ${submissionId}, language :${language}`);

    const runId = `judge_${submissionId}_${Date.now()}`;
    const hostMountPath = path.join("/tmp", runId);

    try {
        fs.mkdirSync(hostMountPath, { recursive: true });

        let fileName = "Solution.js";
        if (language === "c" || language === "cpp") fileName = "main.cpp";

        fs.writeFileSync(path.join(hostMountPath, fileName), code, "utf-8");

        const podmanCmd = `podman run --rm \
            -v ${hostMountPath}:/usr/src/gameroom/db:Z \
            gameroom-base-image \
            node server.js /usr/src/gameroom/db/${fileName}`;

        console.log('podman is running...');
        const { stdout, stderr } = await execAsync(podmanCmd);

        console.log(`Judge logic executed successfully : (#${submissionId})`);
        console.log('output:\n ', stdout);

        if (stderr) {
            console.warn('Stderr:\n', stderr);
        }
    } catch (error) {
        console.error('judge logic execution error : ', error.message);
    } finally {
        try {
            fs.rmSync(hostMountPath, { recursive: true, force: true });
            console.log(`Judge logic cleanup complete : (#${submissionId})`);
        } catch (rmError) {
            console.error('Error during cleanup of judge logic : ', rmError.message);
        }
    }
}

export const judgeService = {
    enqueue(submission) {
        return runJudgeLogic(submission);
    },
};