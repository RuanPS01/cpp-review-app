// Ponte entre os controllers HTTP e o Socket.IO, permitindo que operações longas
// (como a importação de estatísticas) transmitam progresso ao cliente.
let io = null;

function setIo(instance) {
  io = instance;
}

function emitProgress(event, payload) {
  if (!io) return;
  try {
    io.emit(event, payload);
  } catch (err) {
    console.error('[progress] Failed to emit', event, err.message);
  }
}

module.exports = { setIo, emitProgress };
