/** Lifecycle values of a capture; the lowercased state names of `05-state-capture.md`. */
export const STATUSES = [
  'inbox',
  'duplicate',
  'triaged',
  'doubtful',
  'personal',
  'deleted',
  'extracted',
] as const;

export type Status = (typeof STATUSES)[number];

/** Final statuses never re-enter the machine (glossary "Final status"). */
export const FINAL_STATUSES: readonly Status[] = ['personal', 'deleted'];

export const isFinal = (status: Status): boolean => FINAL_STATUSES.includes(status);

/** The owner's answer to a doubtful capture (glossary "Answer"). */
export const ANSWERS = ['work', 'personal', 'delete'] as const;

export type Answer = (typeof ANSWERS)[number];

export const isAnswer = (value: string): value is Answer =>
  (ANSWERS as readonly string[]).includes(value);

/** Categories a doubt may carry (glossary "Doubt"). */
export const DOUBT_CATEGORIES = ['personal-suspected', 'unreadable', 'off-topic'] as const;

export type DoubtCategory = (typeof DOUBT_CATEGORIES)[number];
