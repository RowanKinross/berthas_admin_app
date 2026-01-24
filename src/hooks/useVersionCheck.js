import { useState, useEffect } from 'react';

const useVersionCheck = () => {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  const checkForUpdates = async () => {
    try {
      // Get current app version from environment variable or package.json
      const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
      
      // Fetch server version with cache busting
      const response = await fetch(`/version.json?t=${Date.now()}`);
      if (!response.ok) return;
      
      const serverVersion = await response.json();
      
      // Debug logging
      console.log('Version check:', {
        current: currentVersion,
        server: serverVersion.version,
        match: currentVersion === serverVersion.version
      });
      
      // Compare versions
      if (serverVersion.version !== currentVersion) {
        setShowUpdateBanner(true);
      }
    } catch (error) {
      console.log('Could not check for updates:', error);
    }
  };

  const refreshApp = () => {
    window.location.reload();
  };

  const dismissUpdate = () => {
    setShowUpdateBanner(false);
    // Check again in 10 minutes
    setTimeout(checkForUpdates, 10 * 60 * 1000);
  };

  useEffect(() => {
    // Initial check
    checkForUpdates();
    
    // Check every 5 minutes
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { showUpdateBanner, refreshApp, dismissUpdate };
};

export default useVersionCheck;