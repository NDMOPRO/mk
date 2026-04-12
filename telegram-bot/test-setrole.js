// Test the regex in handleOpsSetRole
function extractCommandArgs(text, command) {
  if (!text) return '';
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, 'i');
  return text.replace(re, '').trim();
}

// Test cases that users might send
const tests = [
  '/setrole @ahmed CEO',
  '/setrole@monthlykey_bot @ahmed CEO',
  '/setrole ahmed CEO',
  '/setrole @Ahmed Manager',
  '/setrole @ahmed staff',
  '/setrole @ahmed ceo',
  '/setrole Ahmed CEO',
];

tests.forEach(text => {
  const args = extractCommandArgs(text, 'setrole');
  const match = args.match(/^@?(\S+)\s+(CEO|Manager|Staff)$/i);
  console.log('Input:', JSON.stringify(text));
  console.log('  args:', JSON.stringify(args));
  console.log('  match:', match ? [match[1], match[2]] : null);
  console.log();
});
