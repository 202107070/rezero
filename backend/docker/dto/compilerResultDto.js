export class CompileResultDto {
    constructor(result = {}) {
        this.submissionId = result.submissionId;
        this.status = result.status;
        this.compileResult = result.compileResult || "";
        this.runtime = result.runtime || "0ms";
        this.memory = result.memory || "0MB";
        this.scannedAt = result.scannedAt || new Date();
    }

    toResponse() {
        return {
            submissionId: this.submissionId,
            status: this.status,
            message: this.status === "SUCCESS" ? "Execution completed." : "Error occurred during execution.",
            error: this.status !== "SUCCESS" ? this.compileResult : null,
            performance: {
                time: this.runtime,
                memory: this.memory,
            },
            timestamp: this.scannedAt,
        };
    }
}