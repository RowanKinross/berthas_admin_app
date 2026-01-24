import React from 'react';
import './UpdateBanner.css';

const UpdateBanner = ({ onRefresh, onDismiss }) => {
  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <div className="update-message">
          <strong>🚀 New version available!</strong>
          <span>Refresh to get the latest features and improvements.</span>
        </div>
        <div className="update-actions">
          <button className="update-btn refresh" onClick={onRefresh}>
            Refresh Now
          </button>
          <button className="update-btn dismiss" onClick={onDismiss}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;