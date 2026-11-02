'use strict';

/** CLI/container lifecycle only; Electron owns and closes its embedded service. */
function installShutdown(server, pendingWrites) {
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    console.log('ROOT: draining requests and saving before shutdown.');
    const deadline = setTimeout(() => {
      console.error('ROOT: shutdown exceeded 20 seconds; closing remaining connections.');
      process.exitCode = 1;
      server.closeAllConnections();
    }, 20_000);
    // Node 24 close() stops accepting connections and closes idle keep-alive sockets.
    // Active requests (including save uploads) finish before the callback runs.
    server.close(async () => {
      try {
        await pendingWrites();
      } finally {
        clearTimeout(deadline);
        process.removeListener('SIGTERM', shutdown);
        process.removeListener('SIGINT', shutdown);
      }
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { installShutdown };
