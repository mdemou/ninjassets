import { Navigate, useParams } from 'react-router';
import { getDocPage } from '~/data/docs-pages';
import { DocsMarkdown } from '~/components/docs/DocsMarkdown';

export default function DocsPage() {
  const { section = '', page = '' } = useParams<{ section: string; page: string }>();
  const doc = getDocPage(section, page);

  if (!doc) {
    return <Navigate to="/docs/getting-started/introduction" replace />;
  }

  return <DocsMarkdown content={doc.content} />;
}
