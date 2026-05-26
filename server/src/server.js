const http = require('http');
const app = require('./app');
const initSocket = require('./core/socket');

const server = http.createServer(app);
const io = initSocket(server);
const port = 3001;

function startServer() {
  server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
}

module.exports = {
  server,
  io,
  startServer
};
