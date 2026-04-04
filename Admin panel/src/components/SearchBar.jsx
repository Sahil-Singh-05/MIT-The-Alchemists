const tabs = [
  { id: 'all', label: 'All' },
  { id: 'pdf', label: 'PDF' },
  { id: 'xlsx', label: 'XLSX' },
  { id: 'email', label: 'Email' },
];

const SearchBar = ({ value, onSearch, currentTab, onTab }) => {
  return (
    <div className="search-filter-box">
      <div className="search-input">
        <span className="search-icon">
          <i className="fa fa-search" aria-hidden="true" />
        </span>
        <input value={value} onChange={(e) => onSearch(e.target.value)} placeholder="Search documents" />
      </div>
      <div className="cat-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={currentTab === tab.id ? 'active' : ''} onClick={() => onTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchBar;
