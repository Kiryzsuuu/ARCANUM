const Log = require('../models/Log');

/**
 * addLog({ actor, actorName, type, action, target, details, severity, ip })
 * Non-blocking — errors silently ignored so it never breaks the main flow
 */
async function addLog(data) {
  try {
    const entry = await Log.create({
      actor:     data.actor     || 'SYSTEM',
      actorName: data.actorName || 'SYSTEM',
      type:      data.type,
      action:    data.action,
      target:    data.target    || '',
      details:   data.details   || null,
      severity:  data.severity  || 'info',
      ip:        data.ip        || ''
    });
    // Broadcast realtime ke log viewer
    if (data.io) {
      data.io.emit('new-log', {
        _id:       entry._id,
        actor:     entry.actor,
        actorName: entry.actorName,
        type:      entry.type,
        action:    entry.action,
        target:    entry.target,
        severity:  entry.severity,
        ip:        entry.ip,
        createdAt: entry.createdAt
      });
    }
    return entry;
  } catch (_) {}
}

module.exports = addLog;
