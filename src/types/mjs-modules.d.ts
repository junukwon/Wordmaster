declare module '*.mjs' {
  export function parseVocabularyMarkdown(
    markdown: string,
    options?: { validate?: boolean },
  ): Array<{
    id: string;
    day: number;
    topic: string;
    term: string;
    partOfSpeech: string[];
    meanings: string[];
    inflection?: string;
  }>;
  export function buildVocabularySources(
    markdowns: Array<{ fileName: string; markdown: string }>,
  ): unknown[];
}
