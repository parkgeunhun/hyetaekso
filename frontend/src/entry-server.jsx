import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App.jsx';
export const render=location=>renderToString(<StaticRouter location={location}><App/></StaticRouter>);
