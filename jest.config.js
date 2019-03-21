module.exports = {
  verbose: true,
  collectCoverageFrom: [
    'packages/**/*.js',
    '!**/**.data.js',
    '!**/*.spec.js',
    '!node_modules/'
  ],
  testMatch: [
    '<rootDir>/**/__tests__/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/test/'
  ],
  coverageReporters: ['json', 'lcov', 'text', 'html'],
  setupFiles: ['<rootDir>/test/setup.js'],
  testURL: 'http://localhost/'
}
