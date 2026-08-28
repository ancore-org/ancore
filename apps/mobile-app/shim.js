if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}
if (typeof process === 'undefined') {
  global.process = require('process');
}
