import express from 'express';
import logger from 'morgan';

import healthRouter from './src/api/health/router.js';
import userRouter from './src/api/user/router.js';
import { notFoundHandler, errorHandler } from './src/middleware/errorHandler.js';

// 비동기 처리 중 예외가 발생해 서버 프로세스가 종료되는 것을 방지
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection 발생:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception 발생:', err);
});

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 서버 상태는 배포 확인용 주소와 API 주소에서 각각 확인하시면 됩니다.
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);
app.use('/api/v1', userRouter);

// 등록되지 않은 주소와 실행 중 발생한 오류는 아래 공통 처리 부분을 확인하시면 됩니다.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;