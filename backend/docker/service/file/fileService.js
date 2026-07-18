import fs from "fs/promises";
import path from "path";

const SANDBOX_PATH = "/home/yhpark/rezero/backend/docker/sandbox";

export const fileService = {
    getExt(language) {
        if (typeof language !== "string" || language.trim().length === 0) {
            throw new Error("지원하지 않는 언어입니다: empty language");
        }

        const lang = language.toLowerCase();
        if (lang === "c") { return "c"; }
        else if (lang === "cpp" || lang === "c++") { return "cpp"; }
        throw new Error(`지원하지 않는 언어입니다: ${language}`);
    },

    async saveSourceCode(userId, language, code) {
        const ext = this.getExt(language);
        const fileName = `${userId}.${ext}`;
        const targetPath = path.join(SANDBOX_PATH, fileName);

        try {
            await fs.mkdir(SANDBOX_PATH, { recursive: true });
            console.log(`Source code save start --> filename : ${fileName}`);
            await fs.writeFile(targetPath, code, "utf-8");
            console.log(`Source code save complete --> route : ${targetPath}`);

            return { success: true, fileName, targetPath };
        } catch (error) {
            console.error('Source code save error : ', error.message);
            throw new Error(`Source code file make error : ${error.message}`);
        }
    },

    async deleteSourceCode(userId, language) {
        const ext = this.getExt(language);
        const fileName = `${userId}.${ext}`;
        const targetPath = path.join(SANDBOX_PATH, fileName);

        try {
            await fs.unlink(targetPath);
            console.log(`file remove complete : ${fileName}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return true;
            }
            console.error('File remove error : ', error.message);
            return false;
        }
    }
};