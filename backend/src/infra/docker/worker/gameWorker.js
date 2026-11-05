import { isolatedRunner } from './isolatedRunner.js';

// Legacy callers use the same isolated executor; never return a fixed success.
export const gameWorker = {
  processSubmission(submission) {
    return isolatedRunner.run({ code: submission.code, language: String(submission.language || '').toUpperCase().replace('C++', 'CPP') });
  },
};
