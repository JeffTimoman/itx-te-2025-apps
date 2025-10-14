// Simple logger utility used across the backend.
// Exposes log.debug/info/warn/error which prefix messages with an ISO timestamp
// and respect a LOG_LEVEL environment variable (error,warn,info,debug).
const util = require('util');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
const CURRENT_LEVEL = LEVELS.hasOwnProperty(configured) ? LEVELS[configured] : LEVELS.info;

function formatArgs(args) {
  return args
    .map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 3 })))
    .join(' ');
}

function write(levelName, args) {
  const lvl = LEVELS[levelName];
  if (lvl > CURRENT_LEVEL) return;
  const ts = new Date().toISOString();
  const msg = formatArgs(Array.from(args));
  const out = `[${ts}] [${levelName.toUpperCase()}] ${msg}`;
  if (levelName === 'error') console.error(out);
  else if (levelName === 'warn') console.warn(out);
  else console.log(out);
}

module.exports = {
  debug: function () { write('debug', arguments); },
  info: function () { write('info', arguments); },
  warn: function () { write('warn', arguments); },
  error: function () { write('error', arguments); },
};
