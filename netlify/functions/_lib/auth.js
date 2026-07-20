const crypto = require("crypto");

// Constant-time passcode comparison so response timing can't be used to
// guess the code character-by-character.
function passcodeMatches(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison of equal length so both branches take
    // roughly the same time.
    crypto.timingSafeEqual(Buffer.alloc(b.length), Buffer.alloc(b.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

module.exports = { passcodeMatches };
