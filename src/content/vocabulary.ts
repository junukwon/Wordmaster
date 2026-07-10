import rawWords from './vocabulary.json';
import type { VocabularyWord } from '../domain/types';

export function loadVocabulary(): VocabularyWord[] {
  return rawWords as VocabularyWord[];
}
