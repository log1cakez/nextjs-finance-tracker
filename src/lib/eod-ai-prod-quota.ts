/** Minimum EOD rows in the selected calendar month before AI summarize is allowed. */
export const EOD_AI_MIN_MONTH_ENTRIES = 10;

/** Max persisted AI summaries in production for the same journal snapshot (same month + `source_journal_stamp`). */
export const EOD_AI_PROD_MAX_RUNS_PER_JOURNAL_STAMP = 3;
