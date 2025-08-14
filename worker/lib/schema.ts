export const CANONICAL_COLUMNS = [
  'submission_id',
  'submitted_at',
  'source',
  'email',
  'full_name',
  'handle',
  'quiz_q1',
  'quiz_q2',
  'quiz_q3',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'user_agent',
  'referrer',
  'processed_at',
  'test',
  'synthetic_submission_id'
];

export const HEADING_MAP: Record<string, string> = {
  'Submission ID': 'submission_id',
  'Timestamp': 'submitted_at',
  'Source': 'source',
  'Email': 'email',
  'Full Name': 'full_name',
  'Handle': 'handle',
  'Question 1': 'quiz_q1',
  'Question 2': 'quiz_q2',
  'Question 3': 'quiz_q3',
  'utm_source': 'utm_source',
  'utm_medium': 'utm_medium',
  'utm_campaign': 'utm_campaign',
  'user_agent': 'user_agent',
  'referrer': 'referrer',
};

export function normalizeSubmission(raw: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const col of CANONICAL_COLUMNS) out[col] = '';
  for (const [label, value] of Object.entries(raw)) {
    const key = HEADING_MAP[label] || label;
    if (key in out) out[key] = value;
  }
  return out;
}
