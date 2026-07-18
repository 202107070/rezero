import { CodeRequestDto } from "../dto/codeRequestDto.js";
import { CompileResultDto } from "../dto/compilerResultDto.js";
import { judgeService } from "../service/judge/judgeLogic.js";

export async function submitCode(req, res, next) {
    try {
        const codeDto = new CodeRequestDto(req.body);

        if (!codeDto.isValid()) {
            return res.status(400).json({
                success: false,
                message: "codeDto validation failed. Please check the request body.",
            });
        }

        const submissionId = Date.now();
        console.log(`Code submission request accepted --> submissionId: ${submissionId}, userId: ${codeDto.userId}`);

        const submission = {
            submissionId,
            userId: codeDto.userId,
            code: codeDto.code,
            language: codeDto.language
        };

        judgeService.enqueue(submission);

        return res.status(202).json({
            success: true,
            message: "code submission request accepted. Judge logic will be executed asynchronously.",
            data: { submissionId, status: "PENDING" },
        });
    } catch (error) {
        next(error);
    }
}

export async function getSubmissionResult(req, res, next) {
    try {
        const { submissionId } = req.params;
        console.log(`Polling submission result --> submissionId : ${submissionId}`);

        const mockRawResult = {
            submissionId,
            status: "SUCCESS",
            compileResult: "Compiled successfully.",
            runtime: "84ms",
            memory: "12MB",
        };

        const resultDto = new CompileResultDto(mockRawResult);

        return res.status(200).json({
            success: true,
            data: resultDto.toResponse(),
        });
    } catch (error) {
        next(error);
    }
}