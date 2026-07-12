export type VocabularyWord = {
  id: string;
  day: number;
  topic: string;
  term: string;
  phonetic: string;
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

export type Confidence = 'unknown' | 'weak' | 'uncertain' | 'strong';
export type MasteryStage =
  | 'unseen'
  | 'recognized'
  | 'recalled'
  | 'spelled'
  | 'mastered_today'
  | 'long_term';
export type ReviewStep = 0 | 1 | 3 | 7 | 14;
export type QuestionType = 'en_to_ko' | 'ko_to_en' | 'spelling';
export type Rating = 'weak' | 'uncertain' | 'strong';

export type WordProgress = {
  wordId: string;
  stage: MasteryStage;
  confidence: Confidence;
  correctCount: number;
  incorrectCount: number;
  reviewStep: ReviewStep;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  updatedAt: string;
  successfulQuestionTypes?: QuestionType[];
};

export type StudyPhase =
  | 'diagnosis'
  | 'recognition'
  | 'recall'
  | 'spelling'
  | 'mixed'
  | 'reinforcement';

export type StudySession = {
  id: string;
  date: string;
  targetDayIds: number[];
  targetWordIds: string[];
  queue: string[];
  currentIndex: number;
  phase: StudyPhase;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  dueReviewIds?: string[];
};

export type TestResult = 'correct' | 'uncertain' | 'incorrect';

export type TestAnswer = {
  wordId: string;
  result: TestResult;
  questionType: QuestionType;
};

export type TestQuestion = {
  wordId: string;
  questionType: QuestionType;
};

export type TestAttempt = {
  id: string;
  dayIds: number[];
  wordIds: string[];
  questions: TestQuestion[];
  mode: QuestionType | 'mixed';
  order: 'number' | 'random';
  answers: TestAnswer[];
  startedAt: string;
  completedAt: string | null;
};
