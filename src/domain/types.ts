export type VocabularyWord = {
  id: string;
  day: number;
  topic: string;
  term: string;
  partOfSpeech: string[];
  meanings: string[];
  inflection?: string;
  note?: string;
};

export type VocabularyDay = {
  day: number;
  topic: string;
  words: VocabularyWord[];
};
