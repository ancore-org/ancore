if (typeof globalThis.crypto === 'undefined') {
  require('react-native-get-random-values');
}
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}
if (typeof process === 'undefined') {
  global.process = require('process');
}
