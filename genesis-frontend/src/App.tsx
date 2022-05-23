import React from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Genesis – це компанія-співзасновник,
          що будує глобальні технологічні бізнеси разом із найкращими підприємцями Центральної та Східної Європи
        </p>
        <a
          className="App-link"
          href="https://www.gen.tech/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
