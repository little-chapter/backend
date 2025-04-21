const pino = require('pino')
const pretty = require('pino-pretty')

module.exports = function getLogger (prefix, logLevel = 'debug') {
  return pino(pretty({
    level: logLevel,
    messageFormat: `[${prefix}]: {msg}`,
    colorize: true,
    sync: true
  }))
}
