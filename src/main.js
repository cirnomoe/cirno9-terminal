/**
 * src/main.js
 * 应用入口：加载冰霜蓝调样式体系并挂载 Web CLI 终端引擎
 */

import './styles/cirno.css';
import './styles/terminal.css';
import { TerminalEngine } from './engine.js';

function bootstrapTerminal() {
  const elements = {
    viewportEl: document.getElementById('terminal-viewport'),
    outputEl: document.getElementById('terminal-output'),
    inputLineEl: document.getElementById('terminal-input-line'),
    promptEl: document.getElementById('terminal-prompt'),
    inputEl: document.getElementById('terminal-input'),
    beforeEl: document.getElementById('input-before'),
    cursorEl: document.getElementById('terminal-cursor'),
    afterEl: document.getElementById('input-after'),
    titleEl: document.getElementById('terminal-title')
  };

  const terminal = new TerminalEngine(elements);
  terminal.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapTerminal);
} else {
  bootstrapTerminal();
}
