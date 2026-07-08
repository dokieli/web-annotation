export const ACTION_TO_MOTIVATION = {
  comment:     'oa:replying',
  approve:     'oa:assessing',
  disapprove:  'oa:assessing',
  specificity: 'oa:questioning',
  bookmark:    'oa:bookmarking',
  highlight:   'oa:highlighting',
}

export const DEFAULT_LANGUAGES = [
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'zh', label: '中文' },
]

export const DEFAULT_LICENSES = [
  { value: 'https://creativecommons.org/licenses/by/4.0/',       label: 'CC BY 4.0' },
  { value: 'https://creativecommons.org/licenses/by-sa/4.0/',    label: 'CC BY-SA 4.0' },
  { value: 'https://creativecommons.org/licenses/by-nd/4.0/',    label: 'CC BY-ND 4.0' },
  { value: 'https://creativecommons.org/licenses/by-nc/4.0/',    label: 'CC BY-NC 4.0' },
  { value: 'https://creativecommons.org/publicdomain/zero/1.0/', label: 'CC0 1.0' },
]

export const DEFAULT_LABELS = {
  comment:     { buttonLabel: '💬', legend: 'Comment',             placeholder: 'Enter your comment…' },
  approve:     { buttonLabel: '👍', legend: 'Approve',             placeholder: 'Why do you approve?' },
  disapprove:  { buttonLabel: '👎', legend: 'Disapprove',          placeholder: 'Why do you disapprove?' },
  specificity: { buttonLabel: '❓', legend: 'Request specificity',  placeholder: 'What needs clarification?' },
  bookmark:    { buttonLabel: '🔖', legend: 'Bookmark',            placeholder: 'Add a note…' },
  highlight:   { buttonLabel: '🖍', legend: 'Highlight',           placeholder: 'Optional note…' },
}
