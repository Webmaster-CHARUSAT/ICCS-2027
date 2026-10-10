#!/usr/bin/env node
/*
 * Creates a faculty account for the /admin review dashboard, writing it to the Users tab of the
 * Google Sheet (via the Apps Script, using backend/.env).
 *
 *   npm run create-faculty -- --name "Dr. Jane Doe" --email jane@charusat.ac.in --role reviewer
 *
 * --role is "reviewer" (default) or "admin". The password is asked for interactively with hidden
 * input — never pass it as an argument, where it would land in shell history and process lists.
 * It can also be piped in on stdin (first line) for non-interactive use.
 */
const readline = require('readline');
const userModel = require('../models/user');
const authService = require('../services/authService');
const idService = require('../services/idService');

const MIN_PASSWORD_LENGTH = 10;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(name|email|role)$/.exec(argv[i]);
    if (m) args[m[1]] = argv[++i];
  }
  return args;
}

// Reads one line from stdin. On a terminal, typed characters are not echoed.
function askHidden(prompt) {
  return new Promise(function (resolve) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      rl._writeToOutput = function () {}; // suppress echo of the typed password
    }
    rl.question(process.stdin.isTTY ? '' : prompt, function (answer) {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = String(args.name || '').trim();
  const email = String(args.email || '').trim().toLowerCase();
  const role = String(args.role || 'reviewer').trim();

  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || userModel.ROLES.indexOf(role) === -1) {
    console.error('Usage: npm run create-faculty -- --name "Full Name" --email user@example.com [--role reviewer|admin]');
    process.exit(1);
  }

  const password = await askHidden('Password for ' + email + ' (min ' + MIN_PASSWORD_LENGTH + ' characters): ');
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error('Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.');
    process.exit(1);
  }
  if (process.stdin.isTTY) {
    const confirm = await askHidden('Confirm password: ');
    if (confirm !== password) {
      console.error('Passwords do not match.');
      process.exit(1);
    }
  }

  const now = new Date().toISOString();
  const record = {
    user_id: idService.generateId('USR'),
    name: name,
    email: email,
    password_hash: await authService.hashPassword(password),
    role: role,
    status: 'active',
    created_at: now,
    updated_at: now
  };

  const result = await userModel.repository.createUnique(record, [
    [{ field: 'email', value: email, normalize: 'email' }]
  ]);
  if (!result.created) {
    console.error('A user with email ' + email + ' already exists in the Users tab.');
    process.exit(1);
  }
  console.log('Created ' + role + ' account for ' + name + ' <' + email + '> (' + record.user_id + ').');
}

main().catch(function (err) {
  console.error('Failed to create faculty account: ' + err.message);
  process.exit(1);
});
