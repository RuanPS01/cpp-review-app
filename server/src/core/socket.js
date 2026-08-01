const { Server } = require('socket.io');
const pty = require('node-pty');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { setIo } = require('./progress');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  setIo(io);

  io.on('connection', (socket) => {
    let ptyProcess = null;
    socket.on('run-code', ({ filePath, codeOverride }) => {
      if (!filePath || (!codeOverride && !fs.existsSync(filePath))) return;
      const dir = path.dirname(filePath), originalFileName = path.basename(filePath);
      let fileNameToCompile = originalFileName, isTemporary = false;
      if (codeOverride) {
        fileNameToCompile = `${path.basename(originalFileName, path.extname(originalFileName))}_test${path.extname(originalFileName)}`;
        fs.writeFileSync(path.join(dir, fileNameToCompile), codeOverride, 'utf8');
        isTemporary = true;
      }
      const exeName = fileNameToCompile.replace('.cpp', '.exe'), exePath = path.join(dir, exeName);
      socket.emit('terminal-data', `\r\nCompiling ${fileNameToCompile}...\r\n`);
      const compile = spawn('g++', [fileNameToCompile, '-o', exeName], { cwd: dir, shell: true });
      let ce = '';
      compile.stderr.on('data', d => ce += d.toString());
      compile.on('close', c => {
        if (c !== 0) {
          socket.emit('terminal-data', `\r\nFailed:\r\n${ce.replace(/\n/g, '\r\n')}`);
          if (isTemporary) try { fs.unlinkSync(path.join(dir, fileNameToCompile)); } catch(e) {}
          return;
        }
        socket.emit('terminal-data', `\x1b[32mSuccess. Running...\x1b[0m\r\n\r\n`);
        try {
          ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], { name: 'xterm-color', cols: 80, rows: 24, cwd: dir, env: process.env });
          ptyProcess.onData(d => socket.emit('terminal-data', d));
          setTimeout(() => { if (ptyProcess) ptyProcess.write(process.platform === 'win32' ? `${exeName}\r\n` : `./${exeName}\n`); }, 500);
          ptyProcess.onExit(({ exitCode }) => {
            socket.emit('terminal-data', `\r\nExited with code ${exitCode}\r\n`);
            ptyProcess = null;
            if (isTemporary) setTimeout(() => { try { fs.unlinkSync(path.join(dir, fileNameToCompile)); } catch(e) {} try { fs.unlinkSync(exePath); } catch(e) {} }, 1000);
          });
        } catch (err) {}
      });
    });
    socket.on('terminal-input', d => { if (ptyProcess) ptyProcess.write(d); });
    socket.on('terminal-resize', ({ cols, rows }) => { if (ptyProcess && cols && rows) try { ptyProcess.resize(cols, rows); } catch (e) {} });
    socket.on('disconnect', () => { if (ptyProcess) try { ptyProcess.kill(); } catch (e) {} });
  });

  return io;
}

module.exports = initSocket;
