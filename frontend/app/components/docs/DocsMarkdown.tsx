import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface DocsMarkdownProps {
  content: string;
}

const markdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="docs-table-scroll">
      <table {...props}>{children}</table>
    </div>
  ),
};

export function DocsMarkdown({ content }: DocsMarkdownProps) {
  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
