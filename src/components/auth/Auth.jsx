import React, { useState, useRef } from 'react';
import './auth.css';

function Auth({ showModal, handleAuth }) {
  const [code, setCode] = useState(['', '', '', '']);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const handleChange = (index, value) => {
    if (/^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      // Move focus to the next input
      if (index < 3 && value !== '') {
        inputRefs[index + 1].current.focus();
      }
    }
  };

  const handleSubmit = () => {
    const enteredCode = code.join('');
    handleAuth(enteredCode);
  };

  if (!showModal) return null;

  return (
    <div className="modal-backdrop">
      <div className="modalBox">
        <div className="modal">
          <form onSubmit={handleSubmit}>
            <div>
              <h2>Enter Passcode:</h2>
              {code.map((digit, index) => (
                <input
                  key={index}
                  className='passcode'
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  ref={inputRefs[index]}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  required
                />
              ))}
            </div>
            <button className="button passSubmit" type="submit">
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Auth;

