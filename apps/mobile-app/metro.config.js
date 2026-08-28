const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const nodeModules = path.resolve(__dirname, 'node_modules');

const config = {
  watchFolders: [root],
  resolver: {
    nodeModulesPaths: [nodeModules, path.resolve(root, 'node_modules')],
    extraNodeModules: {
      buffer: path.resolve(nodeModules, 'buffer'),
      crypto: path.resolve(nodeModules, 'crypto'),
      stream: path.resolve(nodeModules, 'stream'),
      events: path.resolve(nodeModules, 'events'),
      process: path.resolve(nodeModules, 'process'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
