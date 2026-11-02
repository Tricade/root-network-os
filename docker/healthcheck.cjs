'use strict';

const http = require('node:http');
const request = http.get(
  {
    hostname: '127.0.0.1',
    port: process.env.ROOT_PORT || 18473,
    path: '/api/health',
    timeout: 2000,
  },
  (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (part) => {
      body += part;
    });
    response.on('end', () => {
      try {
        const health = JSON.parse(body);
        process.exitCode =
          response.statusCode === 200 &&
          health.app === 'ROOT' &&
          health.release === require('../package.json').version
            ? 0
            : 1;
      } catch {
        process.exitCode = 1;
      }
    });
  },
);
request.on('timeout', () => request.destroy(new Error('Health check timed out')));
request.on('error', () => {
  process.exitCode = 1;
});
