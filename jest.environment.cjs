const { default: JSDOMEnvironment } = require('@jest/environment-jsdom-abstract');
const jsdom = require('jsdom');

module.exports = class MythoriaJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context, jsdom);
  }
};
