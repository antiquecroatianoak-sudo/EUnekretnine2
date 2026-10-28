// TEST ONLY entry for the browser checks: renders the real dashboard component.
import {createRoot} from 'react-dom/client';
import Dashboard from '../sites-review/app/platform.tsx';
createRoot(document.getElementById('root')).render(<Dashboard userName='TEST ONLY'/>);
