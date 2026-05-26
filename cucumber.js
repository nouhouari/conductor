const common = {
  require: ['src/hooks/index.ts'],
  requireModule: ['ts-node/register'],
  format: [
    'progress-bar',
    'allure-cucumberjs/reporter',
    'json:reports/cucumber-report.json'
  ],
  formatOptions: { snippetInterface: 'async-await' },
  worldParameters: {}
};

module.exports = {
  default: {
    ...common,
    paths: ['example/features/**/*.feature']
  },
  web: {
    ...common,
    paths: ['example/features/web/**/*.feature'],
    tags: '@web'
  },
  api: {
    ...common,
    paths: ['example/features/api/**/*.feature'],
    tags: '@api'
  },
  mobile: {
    ...common,
    paths: ['example/features/**/*.feature'],
    tags: '@mobile'
  },
  example: {
    ...common,
    paths: ['example/features/**/*.feature'],
    require: [
      'src/hooks/index.ts',
      'example/step-definitions/**/*.ts'
    ]
  }
};
