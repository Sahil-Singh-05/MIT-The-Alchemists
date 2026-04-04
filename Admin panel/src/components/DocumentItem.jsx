const iconMap = {
  pdf: 'fa-file-pdf-o',
  xlsx: 'fa-file-excel-o',
  email: 'fa-envelope-o',
};

const DocumentItem = ({ doc, onView }) => {
  return (
    <div className="document-item" onClick={onView}>
      <div className="file-info">
        <div className={`file-pill ${doc.type}`}>
          <i className={`fa ${iconMap[doc.type] || 'fa-file-o'}`} aria-hidden="true" />
        </div>
        <div className="file-name">{doc.name}</div>
      </div>
      <button type="button">View</button>
    </div>
  );
};

export default DocumentItem;
