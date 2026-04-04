import { motion } from 'framer-motion';

const DocumentModal = ({ doc, onClose, onDelete, onOpenViewer }) => {
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22 }}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">{doc.name}</div>
            <div className="modal-meta">
              <span className="badge pdf">{doc.type.toUpperCase()}</span>
              <span className="badge indexed">Indexed</span>
              <span className="badge category">{doc.category}</span>
            </div>
          </div>
          <div className="modal-header-actions">
            <button className="small-icon-btn" type="button" onClick={onDelete} title="Delete">
              <i className="fa fa-trash-o" aria-hidden="true" />
            </button>
            <button className="small-icon-btn" type="button" onClick={onClose} title="Close">
              <i className="fa fa-times" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-row">
            <div className="meta-label">File Size</div>
            <div className="meta-value">{doc.size}</div>
          </div>
          <div className="meta-row">
            <div className="meta-label">Pages</div>
            <div className="meta-value">{doc.pages}</div>
          </div>
          <div className="meta-row">
            <div className="meta-label">Uploaded by</div>
            <div className="meta-value">{doc.uploadedBy}</div>
          </div>
          <div className="meta-row">
            <div className="meta-label">Upload date</div>
            <div className="meta-value">{doc.uploadDate}</div>
          </div>
          <div className="meta-row" style={{ gridColumn: 'span 2' }}>
            <div className="meta-label">Total queries answered</div>
            <div className="meta-value">{doc.totalQueries}</div>
          </div>
        </div>

        <div className="preview-block">{doc.description}</div>

        <div className="modal-actions">
          <button className="primary-btn" type="button" onClick={onOpenViewer}>Open in Viewer</button>
          <button className="small-icon-btn" type="button" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DocumentModal;
