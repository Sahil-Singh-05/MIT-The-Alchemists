import { useCallback, useState } from 'react';

const UploadBox = ({ onFilesDrop, onFilesSelect, isUploading, uploadProgress }) => {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length) onFilesDrop(files);
    },
    [onFilesDrop]
  );

  const handleSelect = (e) => {
    const files = e.target.files;
    if (files && files.length) onFilesSelect(files);
  };

  return (
    <label
      htmlFor="fileUploader"
      className={`upload-box ${dragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="icon">
        <i className="fa fa-cloud-upload" aria-hidden="true" />
      </div>
      <div className="title">Choose Files</div>
      <div className="subtitle">(only PDF/.csv/.eml)</div>
      <div className="hint">Limit 200MB per file</div>
      <input id="fileUploader" type="file" multiple onChange={handleSelect} accept=".pdf,.xlsx,.csv,.eml" />
      {isUploading && (
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
    </label>
  );
};

export default UploadBox;
