import { getAllDocuments } from '@/actions/document-actions';
import { DocumentsClient } from './client';

export default async function DocumentsPage() {
  const result = await getAllDocuments();
  const documents = result.success && result.data ? result.data : [];

  return <DocumentsClient initialDocuments={documents} />;
}
