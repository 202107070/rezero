export class CodeRequestDto {
    constructor(data) {
        this.userId = typeof data?.userId === "string" ? data.userId.trim() : data?.userId;
        this.problemId = data?.problemId;
        this.code = typeof data?.code === "string" ? data.code.trim() : data?.code;
        this.language = typeof data?.language === "string" ? data.language.trim() : data?.language;
    }

    isValid() {
        if (!this.userId || typeof this.userId !== "string") return false;
        const normalizedProblemId = typeof this.problemId === "string" ? Number(this.problemId) : this.problemId;
        if (typeof normalizedProblemId !== "number" || Number.isNaN(normalizedProblemId)) return false;
        if (!this.code || typeof this.code !== "string" || this.code.length === 0) return false;
        
        const allowedLanguages = ["c", "cpp", "c++"];
        if (!this.language || typeof this.language !== "string" || !allowedLanguages.includes(this.language.toLowerCase()))
            return false;

        return true;
    }
}