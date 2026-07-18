import express from 'express';
import logger from 'morgan';

import healthRouter from './src/api/health/router.js';
import { notFoundHandler, errorHandler } from './src/middleware/errorHandler.js';

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 서버 상태는 배포 확인용 주소와 API 주소에서 각각 확인하시면 됩니다.
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// 등록되지 않은 주소와 실행 중 발생한 오류는 아래 공통 처리 부분을 확인하시면 됩니다.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
