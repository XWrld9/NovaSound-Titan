import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n'; // i18n — doit être importé avant tout composant

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);