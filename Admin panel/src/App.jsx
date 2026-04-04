import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MOCK_DOCUMENTS } from './data/mockDocs';
import Sidebar from './components/Sidebar.jsx';
import UploadBox from './components/UploadBox.jsx';
import SearchBar from './components/SearchBar.jsx';
import DocumentList from './components/DocumentList.jsx';
import DocumentModal from './components/DocumentModal.jsx';
import Tickets from './pages/Tickets.tsx';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createMockPreviewMarkup = (doc) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(doc.name)}</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        background: #efe2fb;
        color: #2d2357;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }
      .viewer {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        border: 2px solid #b174e7;
        border-radius: 24px;
        padding: 28px;
      }
      h1 {
        margin: 0 0 12px;
        color: #43348b;
        font-size: 30px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }
      .meta-item {
        background: #f7f1ff;
        border: 1px solid #dbc9f7;
        border-radius: 14px;
        padding: 14px 16px;
      }
      .label {
        font-size: 12px;
        color: #6f63a7;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .value {
        font-size: 16px;
        font-weight: 700;
      }
      .content {
        background: #fbf8ff;
        border: 1px solid #e5daf7;
        border-radius: 16px;
        padding: 20px;
        font-size: 16px;
        line-height: 1.7;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div class="viewer">
      <h1>${escapeHtml(doc.name)}</h1>
      <div class="meta">
        <div class="meta-item">
          <div class="label">Type</div>
          <div class="value">${escapeHtml(doc.type.toUpperCase())}</div>
        </div>
        <div class="meta-item">
          <div class="label">Category</div>
          <div class="value">${escapeHtml(doc.category)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Uploaded By</div>
          <div class="value">${escapeHtml(doc.uploadedBy)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Upload Date</div>
          <div class="value">${escapeHtml(doc.uploadDate)}</div>
        </div>
      </div>
      <div class="content">${escapeHtml(doc.description)}</div>
    </div>
  </body>
</html>`;

function App() {
  const [currentPage, setCurrentPage] = useState('uploads');
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const objectUrlsRef = useRef(new Set());

  const registerObjectUrl = (url) => {
    if (url?.startsWith('blob:')) {
      objectUrlsRef.current.add(url);
    }
    return url;
  };

  const revokeObjectUrl = (url) => {
    if (objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  };

  const buildMockPreviewUrl = (doc) => {
    const blob = new Blob([createMockPreviewMarkup(doc)], { type: 'text/html' });
    return registerObjectUrl(URL.createObjectURL(blob));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDocuments(
        MOCK_DOCUMENTS.map((doc) => ({
          ...doc,
          previewUrl: buildMockPreviewUrl(doc),
        }))
      );
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => (filter === 'all' ? true : doc.type === filter))
      .filter((doc) => doc.name.toLowerCase().includes(search.toLowerCase()));
  }, [documents, filter, search]);

  const handleFilesAdded = (files) => {
    const allowed = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'message/rfc822'];
    const validFiles = Array.from(files).filter((file) => allowed.includes(file.type) || file.name.match(/\.(pdf|xlsx|csv|eml)$/i));

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const process = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(process);
          const newDocs = validFiles.map((file, idx) => ({
            id: `${Date.now()}-${idx}`,
            name: file.name,
            type: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : file.name.toLowerCase().endsWith('.eml') ? 'email' : 'xlsx',
            size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            pages: 1,
            uploadedBy: 'You',
            uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            description: 'Uploaded document preview not available in mock.',
            category: 'Uploaded',
            totalQueries: 0,
            previewUrl: registerObjectUrl(URL.createObjectURL(file)),
          }));
          setDocuments((prev) => [...newDocs, ...prev]);
          setTimeout(() => setIsUploading(false), 300);
          return 100;
        }
        return prev + 16;
      });
    }, 80);
  };

  const handleOpen = (doc) => setSelectedDoc(doc);
  const handleClose = () => setSelectedDoc(null);
  const handleDelete = (docId) => {
    setDocuments((prev) => {
      const docToDelete = prev.find((doc) => doc.id === docId);
      if (docToDelete?.previewUrl) {
        revokeObjectUrl(docToDelete.previewUrl);
      }
      return prev.filter((doc) => doc.id !== docId);
    });
    setSelectedDoc(null);
  };
  const handleOpenViewer = (doc) => {
    if (!doc?.previewUrl) return;
    window.open(doc.previewUrl, '_blank', 'noopener');
  };
  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedDoc(null);
  };

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activePage={currentPage}
        isCollapsed={isSidebarCollapsed}
        onNavigate={handlePageChange}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      <main className="main-content">
        {currentPage === 'uploads' ? (
          <>
            <div className="header">Upload Documents</div>

            <UploadBox
              isDragging={false}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onFilesDrop={handleFilesAdded}
              onFilesSelect={handleFilesAdded}
            />

            <SearchBar value={search} onSearch={setSearch} currentTab={filter} onTab={setFilter} />

            <DocumentList docs={filteredDocuments} onView={handleOpen} />

            <AnimatePresence>
              {selectedDoc && (
                <DocumentModal
                  doc={selectedDoc}
                  onClose={handleClose}
                  onDelete={() => handleDelete(selectedDoc.id)}
                  onOpenViewer={() => handleOpenViewer(selectedDoc)}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          <Tickets />
        )}
      </main>
    </div>
  );
}

export default App;
