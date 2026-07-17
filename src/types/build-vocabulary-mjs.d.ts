declare module '../../scripts/build-vocabulary.mjs' {
  export type VocabularyWordRecord = {
    id: string;
    day: number;
    topic: string;
    term: string;
    partOfSpeech: string[];
    meanings: string[];
    inflection?: string;
  };

  export function parseVocabularyMarkdown(
    markdown: string,
    options?: { validate?: boolean },
  ): VocabularyWordRecord[];

  export function buildVocabularySources(
    markdowns: Array<{ fileName: string; markdown: string }>,
  ): VocabularyWordRecord[];
}
