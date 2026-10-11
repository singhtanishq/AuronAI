import hljs from 'highlight.js/lib/core';

// Register a focused set of common languages instead of the full ~190-language
// bundle; this keeps the bundle small and covers typical chat code blocks.
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const languages: Record<string, unknown> = {
  bash,
  cpp,
  csharp,
  css,
  diff,
  go,
  graphql,
  java,
  javascript,
  js: javascript,
  json,
  kotlin,
  makefile,
  markdown,
  md: markdown,
  python,
  py: python,
  rust,
  shell,
  sh: shell,
  sql,
  swift,
  typescript,
  ts: typescript,
  tsx: typescript,
  jsx: javascript,
  xml,
  html: xml,
  yaml,
  yml: yaml,
};

for (const [name, definition] of Object.entries(languages)) {
  hljs.registerLanguage(name, definition as never);
}

export default hljs;
