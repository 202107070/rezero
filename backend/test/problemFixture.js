import { readFileSync } from 'node:fs';

// Read the checked-in DB snapshot without executing its SQL or changing any DB.
export function readProblemFixture() {
  const columns = ['id', 'type', 'difficulty', 'title', 'question', 'answer', 'options', 'correctIndex', 'explanation', 'description', 'input', 'output', 'visual', 'capabilityOverrides'];
  return readFileSync(new URL('../database/setup.sql', import.meta.url), 'utf8').split('\n')
    .filter(line => line.startsWith('INSERT INTO problems ')).map(line => {
      const values = [...line.slice(line.indexOf(' VALUES (') + 9, -2).matchAll(/CONVERT\(0x([0-9a-f]+) USING utf8mb4\)|NULL|-?\d+/g)]
        .map(match => match[1] ? Buffer.from(match[1], 'hex').toString('utf8') : match[0] === 'NULL' ? null : Number(match[0]));
      if (values.length !== columns.length) throw new Error('Unexpected problem snapshot format');
      return Object.fromEntries(columns.map((column, index) => [column,
        ['answer', 'options', 'visual', 'capabilityOverrides'].includes(column) && values[index] != null ? JSON.parse(values[index]) : values[index]]));
    });
}
