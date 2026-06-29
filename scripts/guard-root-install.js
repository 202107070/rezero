const cwd = process.cwd().replace(/\\/g, '/');
const isRoot = /\/rezero$/i.test(cwd) || cwd.endsWith('/rezero');

if (!isRoot) {
  console.error('\n[rezero] 이 프로젝트는 저장소 루트에서 npm install 해야 합니다.\n');
  console.error('  cd ..');
  console.error('  npm install\n');
  console.error('실행도 루트에서: npm run electron:dev / npm run backend\n');
  process.exit(1);
}
