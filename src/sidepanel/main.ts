import { render, h } from 'preact';
import { App } from './App.js';

const root = document.getElementById('app');
if (root) {
  render(h(App, {}), root);
}
