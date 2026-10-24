import { createRoot } from 'react-dom/client';
import Storefront from './storefront';
import DiscoveryPrototype from './discovery-prototype';
import './styles.css';
import './storefront.css';
import './storefront-v2.css';
import './experience-v9.css';
import './ux-v9-1.css';
createRoot(document.getElementById('root')!).render(import.meta.env.VITE_STATIC_DEMO !== '1' && location.hash === '#/lab' ? <DiscoveryPrototype /> : <Storefront />);

import './catalog/gallery.css';
