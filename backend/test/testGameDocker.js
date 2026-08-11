import { gameService } from "#docker/service/gameService.js";
import { gameWorker } from "#docker/worker/gameWorker.js";
import { fileService } from "#docker/service/fileService.js";

async function runGameDockerTest() {
  console.log("==========================================");
  console.log("[Test] 1. Game Docker & Sandbox Engine Test");
  console.log("==========================================");

  const testUserId = "test_user_999";
  const testRoomId = "room_test_1001";

  try {
    console.log(
      "\n[Step 1] Testing base image build (gameService.buildBaseImage)...",
    );
    const buildResult = await gameService.buildBaseImage();

    let buildStatus = "FAILED";
    if (buildResult.success) {
      buildStatus = "SUCCESS";
    }
    console.log(" Build Result:", buildStatus);

    console.log("\n[Step 2] Testing Python Code Submission & Execution...");
    const pythonCode = "print('Hello from Python Sandbox Game Engine!')";

    await gameService.processCodeSubmission({
      submissionId: 1001,
      userId: testUserId,
      language: "python",
      code: pythonCode,
      roomId: testRoomId,
    });

    const pyResult = await gameWorker.processSubmission({
      submissionId: 1001,
      userId: testUserId,
      language: "python",
      roomId: testRoomId,
    });

    console.log(" Python Execution Result:", pyResult);

    console.log("\n[Step 3] Testing C++ Code Compilation & Execution...");
    const cppCode =
      '#include <iostream>\nint main() {\n    std::cout << "Hello C++ Engine" << std::endl;\n    return 0;\n}';

    await gameService.processCodeSubmission({
      submissionId: 1002,
      userId: testUserId,
      language: "cpp",
      code: cppCode,
      roomId: testRoomId,
    });

    const cppResult = await gameWorker.processSubmission({
      submissionId: 1002,
      userId: testUserId,
      language: "cpp",
      roomId: testRoomId,
    });

    console.log(" C++ Execution Result:", cppResult);

    console.log("\n[Step 4] Cleaning up sandbox files...");
    await fileService.deleteSourceCode(testUserId, "python");
    await fileService.deleteSourceCode(testUserId, "cpp");
    console.log(" Cleanup complete.");

    console.log("\n Game Docker Engine Test Completed Successfully!");
  } catch (error) {
    console.error("\n Game Docker Test Failed:", error);
  }
}

runGameDockerTest();
