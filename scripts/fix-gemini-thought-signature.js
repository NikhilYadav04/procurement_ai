const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'node_modules', '@langchain', 'google-genai', 'dist', 'utils');
const FILES = ['common.js', 'common.cjs'];

const SIG_BUILDER = `
	const __thoughtSignatures = {};
	if (Array.isArray(candidate?.content?.parts)) {
		for (const __p of candidate.content.parts) {
			if (__p && __p.functionCall && __p.thoughtSignature) {
				const __k = __p.functionCall.id || __p.functionCall.name;
				if (__k) __thoughtSignatures[__k] = __p.thoughtSignature;
			}
		}
	}`;

function patch(file) {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) return `skip    ${file} (not found)`;

  let src = fs.readFileSync(full, 'utf8');
  const before = src;
  let n = 0;

  if (!src.includes('const __thoughtSignatures = {}')) {
    src = src.replace(
      /(const \{ content: candidateContent,\s*\.\.\.generationInfo \} = candidate;)/g,
      (m) => { n++; return m + SIG_BUILDER; }
    );
  }

  src = src.replace(
    /additional_kwargs:\s*\{\s*\.\.\.generationInfo\s*\}/g,
    () => { n++; return 'additional_kwargs: { ...generationInfo, __thoughtSignatures }'; }
  );

  src = src.replace(
    /additional_kwargs:\s*\{\s*\},(\s*\n\s*response_metadata)/g,
    (m, tail) => { n++; return 'additional_kwargs: { __thoughtSignatures },' + tail; }
  );

  src = src.replace(
    /functionCalls = message\.tool_calls\.map\(\(tc\) => \{\s*return \{ functionCall: \{\s*name: tc\.name,\s*args: tc\.args\s*\} \};\s*\}\);/,
    () => {
      n++;
      return `functionCalls = message.tool_calls.map((tc) => {
		const __sigs = (message.additional_kwargs && message.additional_kwargs.__thoughtSignatures) || {};
		const __part = { functionCall: {
			name: tc.name,
			args: tc.args
		} };
		const __sig = __sigs[tc.id] || __sigs[tc.name];
		if (__sig) __part.thoughtSignature = __sig;
		return __part;
	});`;
    }
  );

  const hasIn = src.includes('__thoughtSignatures[__k]');
  const hasOut = src.includes('__part.thoughtSignature');

  if (src !== before) fs.writeFileSync(full, src, 'utf8');

  if (!hasIn || !hasOut) return `FAIL    ${file} (inbound=${hasIn} outbound=${hasOut})`;
  return n > 0 ? `patched ${file} (${n} edits)` : `ok      ${file} (already patched)`;
}

console.log('[gemini-thought-signature] patching @langchain/google-genai');
for (const f of FILES) console.log('  ' + patch(f));
