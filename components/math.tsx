import katex from 'katex';
export function MathText({ text }: { text: string }) {
  return (
    <span>
      {text.split(/(\$[^$]+\$)/g).map((part, i) =>
        part.startsWith('$') && part.endsWith('$') ? (
          <span
            className="katex-wrap"
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.slice(1, -1), {
                throwOnError: false,
                trust: false,
                strict: 'warn',
                maxExpand: 100,
                maxSize: 10,
              }),
            }}
          />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
