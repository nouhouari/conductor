const path = require('path');

// Resolve the framework hooks by path so they always share the same
// @cucumber/cucumber instance as the runner (workspaces ensures one copy).
const conductorHooks = path.join(__dirname, '..', 'src', 'hooks', 'index.ts');

const common = {
  requireModule: ['ts-node/register', 'tsconfig-paths/register'],
  require: [conductorHooks, 'step-definitions/**/*.ts'],
  format: [
    'progress-bar',
    'allure-cucumberjs/reporter',
    'json:reports/cucumber-report.json'
  ],
  formatOptions: { snippetInterface: 'async-await' }
};

module.exports = {
  default: {
    ...common,
    paths: ['features/**/*.feature']
  },
  web: {
    ...common,
    paths: ['features/web/**/*.feature'],
    tags: '@web'
  },
  api: {
    ...common,
    paths: ['features/api/**/*.feature'],
    tags: '@api'
  },
  mobile: {
    ...common,
    paths: ['features/**/*.feature'],
    tags: '@mobile'
  }
};
