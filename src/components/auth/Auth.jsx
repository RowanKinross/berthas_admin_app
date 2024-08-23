import React, { useState, useRef, useEffect } from 'react';
import './auth.css';

function Auth({ showModal, handleAuth }) {
  const [code, setCode] = useState(['', '', '', '']);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const handleChange = (index, value) => {
    if (/^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      // Move focus to the next input if not on the last one
      if (index < 3 && value !== '') {
        inputRefs[index + 1].current.focus();
      }
    }
  };

  useEffect(() => {
    // Automatically submit if all 4 digits are filled
    if (code.every(digit => digit !== '')) {
      handleSubmit();
    }
  }, [code]); // This effect will run every time `code` changes

  useEffect(() => {
    if (showModal) {
      inputRefs[0].current.focus(); // This line focuses on the first input box
    }
  }, [showModal]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
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

