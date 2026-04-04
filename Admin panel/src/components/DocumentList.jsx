import DocumentItem from './DocumentItem.jsx';

const DocumentList = ({ docs, onView }) => {
  if (!docs.length) {
    return <div className="empty-state">No attachments found. Drag docs in or use upload to add files.</div>;
  }

  return (
    <div className="document-list">
      {docs.map((doc) => (
        <DocumentItem key={doc.id} doc={doc} onView={() => onView(doc)} />
      ))}
    </div>
  );
};

export default DocumentList;
