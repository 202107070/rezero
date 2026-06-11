require('dotenv').config();

const express = require('express');
const { testDbConnection } = require('./src/config/dbConfig.js');
const { connectRedis } = require('./src/config/redisConfig.js');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('server ok');
});

async function bootstrap() {
  await testDbConnection();
  await connectRedis();

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Server bootstrap failed:', err.message);
  process.exit(1);
});
