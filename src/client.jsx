import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './app.jsx';

const root = document.getElementById('root');
hydrateRoot(root, <App route={root.dataset.route} base={root.dataset.base}/>);
