import { stdin, stdout } from 'node:process';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
      data += chunk;
    });
    stdin.on('end', () => resolve(data));
  });
}

function printDecision(permissionDecision, permissionDecisionReason) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason,
    },
  };
  stdout.write(JSON.stringify(out));
}

const blockedPatterns = [
  /git\s+reset\s+--hard/i,
  /git\s+checkout\s+--/i,
  /git\s+clean\s+-fd/i,
  /rm\s+-rf\s+\//i,
  /del\s+\/f\s+\/s\s+\/q/i,
  /format\s+[a-z]:/i,
];

const input = await readStdin();
const normalized = String(input || '').toLowerCase();

const isBlocked = blockedPatterns.some((rx) => rx.test(normalized));

if (isBlocked) {
  printDecision(
    'deny',
    'Bloqueado pelo hook do workspace: padrao de comando potencialmente destrutivo detectado.'
  );
} else {
  printDecision('allow', 'Comando aceito pela protecao de seguranca do workspace.');
}
