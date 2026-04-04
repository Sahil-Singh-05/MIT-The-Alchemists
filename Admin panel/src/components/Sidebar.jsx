import { motion } from 'framer-motion';
import logoImage from '../assets/alchemista.jpeg';

const menu = [
  { id: 'uploads', label: 'Uploads', icon: 'fa-upload' },
  { id: 'tickets', label: 'Tickets', icon: 'fa-ticket' },
];

const Sidebar = ({ activePage, isCollapsed, onNavigate, onToggle }) => {
  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div>
        <div className="sidebar-top">
          <div className="logo">
            <img className="logo-mark" src={logoImage} alt="Alchemist logo" />
            <span className="logo-text">ALCHEMIST</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`fa ${isCollapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`} aria-hidden="true" />
          </button>
        </div>
        <nav>
          {menu.map((item) => (
            <motion.div
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => onNavigate(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigate(item.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className="nav-icon">
                <i className={`fa ${item.icon}`} aria-hidden="true" />
              </span>
              <span className="nav-label">{item.label}</span>
              {activePage === item.id && (
                <motion.span
                  className="active-indicator"
                  layoutId="activeIndicator"
                />
              )}
            </motion.div>
          ))}
        </nav>
      </div>

      <div className="profile">
        <div className="avatar">S</div>
        <div className="profile-name">Sahil Singh</div>
      </div>
    </aside>
  );
};

export default Sidebar;
