import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

const container=document.getElementById('root');
const app=<BrowserRouter><App/></BrowserRouter>;
const route=location.pathname.replace(/\/+$/,'')||'/';
if(container.dataset.route===route&&container.hasChildNodes()) hydrateRoot(container,app);
else createRoot(container).render(app);
