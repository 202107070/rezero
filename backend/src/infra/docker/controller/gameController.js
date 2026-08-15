import { CodeRequestDto, CompileResultDto } from "#docker/dto/gameDto.js";
import { gameService } from "#docker/service/gameService.js";

export async function submitCode(req, res, next) {
  try {
    const codeDto = new CodeRequestDto(req.body);
    if (!codeDto.isValid()) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed." });
    }

    const submissionId = Date.now();
    return res.status(202).json({
      success: true,
      message: "Code submission accepted.",
      data: { submissionId: submissionId, status: "PENDING" },
    });
  } catch (error) {
    next(error);
  }
}
