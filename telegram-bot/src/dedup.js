/**
 * Task Deduplication Engine — Monthly Key Operations HQ
 * ─────────────────────────────────────────────────────────────
 * Smart duplicate detection for tasks. Before creating a new task,
 * checks existing pending tasks for semantic similarity:
 *   - Same or similar assignee
 *   - Similar description/title (keyword overlap + fuzzy matching)
 *
 * If a near-duplicate is found, returns the existing task instead
 * of allowing a new one to be created.
 */

const { resolveTeamMember } = require("./team-members");

// ─── Stop Words (excluded from keyword comparison) ──────────
const STOP_WORDS_EN = new Set([
  "the", "a", "an", "to", "for", "of", "in", "on", "at", "and", "or",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "shall", "can", "need", "must", "it", "its", "this", "that", "with",
  "from", "by", "as", "into", "about", "up", "out", "not", "no", "so",
  "if", "but", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "than", "too", "very", "just", "also",
]);

const STOP_WORDS_AR = new Set([
  "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
  "التي", "الذي", "التى", "الذى", "هو", "هي", "هم", "نحن", "أنا",
  "أنت", "أنتم", "كان", "كانت", "يكون", "تكون", "لا", "لم", "لن",
  "قد", "ما", "أن", "إن", "أو", "و", "ثم", "بل", "لكن", "حتى",
  "كل", "بعض", "غير", "بين", "عند", "فوق", "تحت", "أمام", "خلف",
  "بعد", "قبل", "حول", "ضد", "خلال", "منذ", "عبر",
]);

/**
 * Extract meaningful keywords from a text string.
 * Removes stop words, punctuation, and normalizes.
 * @param {string} text
 * @returns {Set<string>} Set of normalized keywords
 */
function extractKeywords(text) {
  if (!text) return new Set();

  const normalized = text
    .toLowerCase()
    .replace(/@[a-zA-Z0-9_]+/g, "")     // Remove @mentions
    .replace(/#[a-zA-Z0-9_]+/g, "")     // Remove #tags
    .replace(/[^\w\s\u0600-\u06FF]/g, " ") // Keep alphanumeric + Arabic
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter(w => w.length > 1);
  const keywords = new Set();

  for (const word of words) {
    if (!STOP_WORDS_EN.has(word) && !STOP_WORDS_AR.has(word)) {
      keywords.add(word);
    }
  }

  return keywords;
}

/**
 * Calculate Jaccard similarity between two sets.
 * @param {Set} setA
 * @param {Set} setB
 * @returns {number} Similarity score between 0 and 1
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Check if two keyword sets have significant overlap.
 * Uses both Jaccard similarity and absolute keyword match count.
 * @param {Set} keywordsA
 * @param {Set} keywordsB
 * @returns {number} Similarity score 0-1
 */
function keywordSimilarity(keywordsA, keywordsB) {
  const jaccard = jaccardSimilarity(keywordsA, keywordsB);

  // Also check: what fraction of the smaller set is contained in the larger?
  const smaller = keywordsA.size <= keywordsB.size ? keywordsA : keywordsB;
  const larger = keywordsA.size > keywordsB.size ? keywordsA : keywordsB;

  let containment = 0;
  for (const item of smaller) {
    if (larger.has(item)) containment++;
  }
  const containmentRatio = smaller.size === 0 ? 0 : containment / smaller.size;

  // Use the higher of the two scores
  return Math.max(jaccard, containmentRatio);
}

/**
 * Check if two assignees refer to the same person.
 * Handles @username, "Real Name (@username)", raw names, etc.
 * @param {string} assigneeA
 * @param {string} assigneeB
 * @returns {boolean}
 */
function isSameAssignee(assigneeA, assigneeB) {
  if (!assigneeA || !assigneeB) return false;

  // Direct match (case-insensitive)
  const cleanA = assigneeA.toLowerCase().trim();
  const cleanB = assigneeB.toLowerCase().trim();
  if (cleanA === cleanB) return true;

  // Resolve both to team members
  const memberA = resolveTeamMember(assigneeA);
  const memberB = resolveTeamMember(assigneeB);

  // If both resolve to the same username, they're the same person
  if (memberA && memberB && memberA.username === memberB.username) return true;

  // Check if one contains the other's username
  const usernameA = assigneeA.replace(/^@/, "").toLowerCase();
  const usernameB = assigneeB.replace(/^@/, "").toLowerCase();
  if (cleanA.includes(usernameB) || cleanB.includes(usernameA)) return true;

  // Check real name match
  if (memberA && cleanB.includes(memberA.name.toLowerCase())) return true;
  if (memberB && cleanA.includes(memberB.name.toLowerCase())) return true;

  return false;
}

/**
 * Find a duplicate or near-duplicate task among existing pending tasks.
 *
 * @param {Array} pendingTasks - Array of existing pending task objects from DB
 * @param {string} newTitle - Title of the proposed new task
 * @param {string} newAssignee - Assignee of the proposed new task (optional)
 * @param {object} options - Additional options
 * @param {number} options.threshold - Similarity threshold (default 0.45)
 * @returns {object|null} The duplicate task if found, or null
 */
function findDuplicateTask(pendingTasks, newTitle, newAssignee, options = {}) {
  const threshold = options.threshold || 0.45;
  const newKeywords = extractKeywords(newTitle);

  if (newKeywords.size === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const task of pendingTasks) {
    const taskKeywords = extractKeywords(task.title);
    if (taskKeywords.size === 0) continue;

    const similarity = keywordSimilarity(newKeywords, taskKeywords);

    // If assignees match, lower the threshold (more likely a duplicate)
    const assigneeMatch = newAssignee && task.assigned_to
      ? isSameAssignee(newAssignee, task.assigned_to)
      : false;

    const effectiveThreshold = assigneeMatch ? threshold * 0.75 : threshold;

    if (similarity >= effectiveThreshold && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = { ...task, _similarity: similarity, _assigneeMatch: assigneeMatch };
    }
  }

  // Only return if the score is meaningful
  if (bestMatch && bestScore >= (bestMatch._assigneeMatch ? threshold * 0.75 : threshold)) {
    return bestMatch;
  }

  return null;
}

module.exports = {
  extractKeywords,
  keywordSimilarity,
  isSameAssignee,
  findDuplicateTask,
};
