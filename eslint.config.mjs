import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'android-kotlin/**/*', 'app/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
