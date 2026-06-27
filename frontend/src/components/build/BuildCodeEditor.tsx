import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, type KeyBinding } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

interface BuildCodeEditorProps {
  code: string;
  lang: string;
  onChange: (code: string) => void;
}

const TAB_SPACES = '    ';

const pixelEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#1a1e21',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-pixel), "Courier New", monospace',
    fontSize: '18px',
    lineHeight: '1.55',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '12px 14px',
    caretColor: '#f5f6fa',
    color: '#dfe6e9',
  },
  '.cm-line': {
    color: '#dfe6e9',
  },
  '.cm-cursor, &.cm-focused .cm-cursor': {
    borderLeftColor: '#f5f6fa',
  },
  '.cm-gutters': {
    backgroundColor: '#2d3436',
    color: '#b2bec3',
    border: 'none',
    minWidth: '3.2em',
  },
  '.cm-gutterElement': {
    padding: '0 8px 0 4px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#363d40',
    color: '#dfe6e9',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
});

function shouldIndentLine(state: EditorState, pos: number) {
  const line = state.doc.lineAt(pos);
  const beforeCursor = state.doc.sliceString(line.from, pos);
  return beforeCursor.trim().length === 0;
}

function insertTabAtCursor(view: EditorView) {
  view.dispatch(view.state.replaceSelection(TAB_SPACES));
  return true;
}

function handleTab(view: EditorView) {
  const { state } = view;
  if (!state.selection.main.empty) {
    return indentMore(view);
  }
  if (shouldIndentLine(state, state.selection.main.head)) {
    return indentMore(view);
  }
  return insertTabAtCursor(view);
}

const buildKeymap: KeyBinding[] = [
  { key: 'Tab', run: handleTab },
  { key: 'Shift-Tab', run: indentLess },
  ...historyKeymap,
  ...defaultKeymap,
];

function getLanguageExtension(lang: string): Extension {
  switch (lang) {
    case 'JAVA':
      return java();
    case 'PYTHON':
      return python();
    case 'CPP':
      return cpp();
    case 'HTML':
      return html();
    case 'CSS':
      return css();
    default:
      return [];
  }
}

export function BuildCodeEditor({ code, lang, onChange }: BuildCodeEditorProps) {
  const extensions = useMemo(
    () => [
      history(),
      indentUnit.of(TAB_SPACES),
      EditorState.tabSize.of(4),
      oneDark,
      pixelEditorTheme,
      lineNumbers(),
      EditorView.lineWrapping,
      keymap.of(buildKeymap),
      getLanguageExtension(lang),
    ],
    [lang],
  );

  return (
    <CodeMirror
      className="build-codemirror"
      value={code}
      extensions={extensions}
      onChange={onChange}
      basicSetup={false}
      theme="dark"
    />
  );
}
