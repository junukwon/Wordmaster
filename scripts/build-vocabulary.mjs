import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseVocabularyMarkdown(markdown) {
  const words = [];
  let currentDay = null;
  let currentTopic = '';

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## DAY (\d{2}) — (.+)$/);
    if (heading) {
      currentDay = Number(heading[1]);
      currentTopic = heading[2].trim();
      continue;
    }

    if (!/^\| \d{4} \|/.test(line) || currentDay === null) continue;
    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
    const [id, term, partOfSpeech, meaning, inflection] = cells;
    words.push({
      id,
      day: currentDay,
      topic: currentTopic,
      term,
      partOfSpeech: partOfSpeech.split('/').map((value) => value.trim()),
      meanings: [meaning],
      ...(inflection ? { inflection } : {}),
    });
  }

  if (words.length === 0) throw new Error('No vocabulary rows found');
  const ids = new Set();
  words.forEach((word, index) => {
    const expectedId = String(index + 1).padStart(4, '0');
    if (word.id !== expectedId) throw new Error(`Expected ${expectedId}, got ${word.id}`);
    if (ids.has(word.id)) throw new Error(`Duplicate id: ${word.id}`);
    if (!word.term || !word.meanings[0]) throw new Error(`Empty content: ${word.id}`);
    ids.add(word.id);
  });

  const days = new Map();
  words.forEach((word) => days.set(word.day, (days.get(word.day) ?? 0) + 1));
  const dayNumbers = [...days.keys()].sort((a, b) => a - b);
  dayNumbers.forEach((day, index) => {
    if (day !== index + 1) throw new Error(`Missing DAY ${String(index + 1).padStart(2, '0')}`);
    const count = days.get(day);
    if (count !== 25) throw new Error(`DAY ${day} has ${count} words`);
  });
  return words;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const root = path.resolve(path.dirname(scriptPath), '..');
  const input = path.join(root, 'content', 'source', '영어_단어_DAY01-10.md');
  const output = path.join(root, 'src', 'content', 'vocabulary.json');
  const words = parseVocabularyMarkdown(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(words, null, 2)}\n`, 'utf8');
  console.log(`Generated ${words.length} vocabulary records`);
}
