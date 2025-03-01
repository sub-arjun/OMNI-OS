/**
 * Sidebar
 */
import { useLocation } from 'react-router-dom';
import useAppearanceStore from 'stores/useAppearanceStore';
import GlobalNav from './GlobalNav';
import ChatNav from './ChatNav';
import AppNav from './AppNav';
import Footer from './Footer';

import './AppSidebar.scss';
import BookmarkNav from './BookmarkNav';


export default function Sidebar() {
  const location = useLocation();
  const sidebar = useAppearanceStore((state) => state.sidebar);
  const theme = useAppearanceStore((state) => state.theme);
  const width = sidebar.hidden ? 'w-0' : 'w-auto';
  const left = sidebar.hidden ? 'md:left-0' : '-left-64 md:left-0';
  const leftCollapsed = sidebar.hidden ? '-left-64' : '-left-64 md:left-0';


  const renderNav = () => {
    const activeRoute = location.pathname.split('/')[1];
    switch (activeRoute) {
      case 'apps':
        return <AppNav collapsed={sidebar.collapsed} />;
      case 'bookmarks':
        return <BookmarkNav collapsed={sidebar.collapsed}/>;
      default:
        return <ChatNav collapsed={sidebar.collapsed} />;
    }
  };

  // Glass morphism styles are mostly defined in AppSidebar.scss
  // but we add some dynamic styles based on theme here
  const glassStyles = {
    borderRight: `1px solid rgba(var(--color-border), 0.6)`,
  };

  return (
    <aside
      className={`app-sidebar shadow-md md:shadow-none z-20 pt-10 flex-shrink-0 ${
        sidebar.collapsed ? width : 'w-64 md:w-[17rem]'
      } fixed inset-y-0 top-0 ${
        sidebar.collapsed ? leftCollapsed : left
      } flex flex-col duration-300 h-full md:relative`}
      style={glassStyles}
    >
      {/* Glass reflection effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-white opacity-20"></div>
      
      <div className="flex h-full flex-1 flex-col relative z-10">
        <GlobalNav collapsed={sidebar.collapsed} />
        {renderNav()}
        <Footer collapsed={sidebar.collapsed} />
      </div>
    </aside>
  );
}
