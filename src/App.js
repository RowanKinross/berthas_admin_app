import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import logo from './logo192.png';
import './App.css';
import Staff from './Staff/index';
import Customer from './Customer/index';



function App() {
  return (
    <Router>
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
      </header>

      <body>
          <div class="userButtonContainer">
          <Link to="/customer">
            <button className="userButton" id="customerButton">Customer</button>
          </Link>
          <Link to="/staff">
            <button className="userButton" id="staffButton">Staff</button>
          </Link>
          </div>
          <Routes>
          <Route path="/customer" component={Customer} />
          <Route path="/staff" component={Staff} />
          </Routes>
      </body>

    </div>
    </Router>
  );
}

export default App;
