import readline from 'readline';
import { dockerService } from './docker/docker/dockerService.js';
import { CodeRequestDto } from './docker/dto/codeRequestDto.js';
import { fileService } from './docker/service/file/fileService.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let shuttingDown = false;

async function gracefulShutdown(reason) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    console.log(`\n종료 처리 중... (${reason})`);

    try {
        rl.close();
    } catch {}

    try {
        await dockerService.clearWorkspace();
        await dockerService.stopCompilerContainer();
        console.log("sandbox/resultbox 정리 및 컨테이너 종료 완료");
    } catch (error) {
        console.error("종료 처리 중 오류 발생:", error.message);
    } finally {
        process.exit(0);
    }
}

process.on("SIGINT", () => {
    void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void gracefulShutdown("SIGTERM");
});

// 다중 라인 입력을 받는 함수
const collectCode = () => {
    return new Promise((resolve) => {
        let code = "";
        console.log("코드를 입력하세요 (끝나면 다음 줄에 'EXIT' 입력):");
        
        const lineHandler = (line) => {
            if (line.trim().toUpperCase() === 'EXIT') {
                rl.removeListener('line', lineHandler);
                resolve({ code: code.trim(), isFinished: true });
            } else {
                code += line + "\n";
            }
        };
        rl.on('line', lineHandler);
    });
};

async function main() {
    console.log("=== 게임룸 컴파일러 시스템 시작 ===");
    
    const userId = await new Promise(r => rl.question("사용자 아이디를 입력하세요: ", r));
    console.log(`[${userId}] 님 환영합니다.`);

    while (true) {
        console.log("\n-------------------------------------------");
        const language = await new Promise(r => rl.question("언어를 선택하세요 (c / cpp): ", r));
        
        const { code, isFinished } = await collectCode();
        if (isFinished && code.length === 0) break;

        const codeDto = new CodeRequestDto({ userId, problemId: 0, code, language });
        
        if (!codeDto.isValid()) {
            console.log("유효하지 않은 요청입니다.");
            continue;
        }

        try {
            console.log("샌드박스에 코드를 저장 중...");
            await fileService.saveSourceCode(userId, language, codeDto.code);

            console.log("컴파일 실행 중...");
            const result = await dockerService.compileCode(userId, language);
            
            if (result.success) {
                console.log("컴파일 성공!");
                if (result.stdout && result.stdout.trim().length > 0) {
                    console.log("[compiler stdout]\n" + result.stdout.trim());
                }
                if (result.stderr && result.stderr.trim().length > 0) {
                    console.log("[compiler stderr]\n" + result.stderr.trim());
                }

                console.log("실행 결과 확인 중...");
                const runResult = await dockerService.runCompiledBinary(userId);

                if (runResult.success) {
                    const output = runResult.stdout?.trim() || "(출력 없음)";
                    console.log("[program output]\n" + output);
                    if (runResult.stderr && runResult.stderr.trim().length > 0) {
                        console.log("[program stderr]\n" + runResult.stderr.trim());
                    }
                } else {
                    console.log("실행 실패:", runResult.stderr);
                }
            } else {
                console.log("컴파일 실패:", result.stderr);
            }
        } catch (err) {
            console.error("오류 발생:", err.message);
        } finally {
            await dockerService.clearSandbox(userId, language).catch(() => {});
        }
    }
    await gracefulShutdown("normal exit");
}

// 메인 함수 실행
main().catch(err => {
    console.error("실행 중 오류 발생:", err);
    void gracefulShutdown("main error");
});