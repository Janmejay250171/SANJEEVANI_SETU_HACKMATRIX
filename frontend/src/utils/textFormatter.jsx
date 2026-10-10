import React from 'react';

/**
 * Parses markdown inline tokens (**bold**, *italic*, `code`) into React elements
 * without leaving raw asterisks or backticks visible to the user.
 */
export function formatInlineMarkdown(str) {
  if (!str || typeof str !== 'string') return '';

  const parts = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let match;
  let lastIndex = 0;
  let key = 0;

  while ((match = tokenRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '0.9em',
            fontFamily: 'monospace'
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }

  return parts.length > 0 ? parts : str;
}

/**
 * Renders paragraphs and bullet lists cleanly, stripping markdown asterisks.
 */
export function renderFormattedText(text) {
  if (!text || typeof text !== 'string') return null;

  const paragraphs = text.split(/\n\s*\n/);

  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n').filter((l) => l.trim().length > 0);
    const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l.trim()));

    if (isBulletList && lines.length > 0) {
      return (
        <ul
          key={pIdx}
          style={{
            margin: '6px 0',
            paddingLeft: '22px',
            listStyleType: 'disc'
          }}
        >
          {lines.map((line, lIdx) => {
            const clean = line.trim().replace(/^[-*•]\s+/, '');
            return (
              <li key={lIdx} style={{ marginBottom: '4px' }}>
                {formatInlineMarkdown(clean)}
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <p key={pIdx} style={{ margin: '6px 0', lineHeight: 1.55 }}>
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {formatInlineMarkdown(line)}
            {lIdx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
}
