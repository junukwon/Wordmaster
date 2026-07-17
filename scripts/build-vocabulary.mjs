import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function validateVocabularyWords(words) {
  if (words.length === 0) throw new Error('No vocabulary rows found');
  const ids = new Set();
  words.forEach((word, index) => {
    const expectedId = String(index + 1).padStart(4, '0');
    if (word.id !== expectedId) throw new Error(`Expected ${expectedId}, got ${word.id}`);
    if (ids.has(word.id)) throw new Error(`Duplicate id: ${word.id}`);
    if (!word.term || !word.meanings[0]) throw new Error(`Empty content: ${word.id}`);
    if (word.requiresPhonetic && !/^\/.+\/$/.test(word.phonetic)) {
      throw new Error(`Invalid phonetic: ${word.id}`);
    }
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

export function parseVocabularyMarkdown(markdown, { validate = true } = {}) {
  const words = [];
  let currentDay = null;
  let currentTopic = '';

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## DAY (\d{2})\s+—\s+(.+)$/) ?? line.match(/^## DAY (\d{2})\s+(.+)$/);
    if (heading) {
      currentDay = Number(heading[1]);
      currentTopic = heading[2].trim();
      continue;
    }

    if (!/^\| \d{4} \|/.test(line) || currentDay === null) continue;
    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
    const requiresPhonetic = cells.length >= 6;
    const [id, term] = cells;
    const phonetic = requiresPhonetic ? cells[2] : '';
    const partOfSpeech = requiresPhonetic ? cells[3] : cells[2];
    const meaning = requiresPhonetic ? cells[4] : cells[3];
    const inflection = requiresPhonetic ? cells[5] : cells[4];
    const word = {
      id,
      day: currentDay,
      topic: currentTopic,
      term,
      phonetic,
      partOfSpeech: partOfSpeech.split('/').map((value) => value.trim()),
      meanings: [meaning],
      ...(inflection ? { inflection } : {}),
    };
    Object.defineProperty(word, 'requiresPhonetic', { value: requiresPhonetic });
    words.push(word);
  }

  return validate ? validateVocabularyWords(words) : words;
}

export function buildVocabularySources(markdowns) {
  const sorted = [...markdowns].sort((a, b) => {
    const dayA = Number(a.fileName.match(/DAY(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const dayB = Number(b.fileName.match(/DAY(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    return dayA - dayB || a.fileName.localeCompare(b.fileName);
  });
  const words = sorted.flatMap(({ markdown }) => parseVocabularyMarkdown(markdown, { validate: false }));
  return validateVocabularyWords(words);
}

function createDayCatalog(words) {
  const days = new Map();
  for (const word of words) {
    const entry = days.get(word.day) ?? { day: word.day, topic: word.topic, wordCount: 0 };
    entry.wordCount += 1;
    days.set(word.day, entry);
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const root = path.resolve(path.dirname(scriptPath), '..');
  const sourceDir = path.join(root, 'content', 'source');
  const sources = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^영어_단어_DAY.*\.md$/.test(entry.name))
    .map((entry) => ({ fileName: entry.name, markdown: fs.readFileSync(path.join(sourceDir, entry.name), 'utf8') }));
  if (sources.length === 0) throw new Error('No vocabulary source files found');

  const words = buildVocabularySources(sources);
  const dayCatalog = createDayCatalog(words);
  const output = path.join(root, 'src', 'content', 'vocabulary.json');
  const publicOutput = path.join(root, 'public', 'data', 'vocabulary.json');
  const catalogOutput = path.join(root, 'src', 'content', 'day-catalog.json');
  const publicCatalogOutput = path.join(root, 'public', 'data', 'day-catalog.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(path.dirname(publicOutput), { recursive: true });
  const json = `${JSON.stringify(words, null, 2)}\n`;
  const catalogJson = `${JSON.stringify(dayCatalog, null, 2)}\n`;
  fs.writeFileSync(output, json, 'utf8');
  fs.writeFileSync(publicOutput, json, 'utf8');
  fs.writeFileSync(catalogOutput, catalogJson, 'utf8');
  fs.writeFileSync(publicCatalogOutput, catalogJson, 'utf8');
  console.log(`Generated ${words.length} vocabulary records`);
}
