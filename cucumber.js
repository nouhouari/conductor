const common = {
  requireModule: ['ts-node/register'],
  require: ['src/hooks/index.ts'],
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
  }
};
