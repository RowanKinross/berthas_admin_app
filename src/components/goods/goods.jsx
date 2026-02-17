// import berthasLogo from './bertha_logo'
import './goods.css';
import React, {useState} from 'react';
import AddDelivery from './AddDelivery';
import DeliveryHistory from './DeliveryHistory';
import InventoryView from './InventoryView';

function Goods() {
  const [currentView, setCurrentView] = useState('inventory'); // 'inventory', 'addDelivery', 'history'

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const handleDeliveryAdded = () => {
    // Switch to inventory view after adding a delivery
    setCurrentView('inventory');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'addDelivery':
        return (
          <AddDelivery 
            onDeliveryAdded={handleDeliveryAdded}
            onCancel={() => setCurrentView('inventory')}
          />
        );
      case 'history':
        return <DeliveryHistory />;
      case 'inventory':
      default:
        return <InventoryView />;
    }
  };

  return (
    <div className='goods navContent'>
      <div className="goods-header">
        <h2>GOODS MANAGEMENT</h2>
        
        <nav className="goods-nav">
          <button 
            className={`button ${currentView === 'inventory' ? 'active' : ''}`}
            onClick={() => handleViewChange('inventory')}
          >
            Current Stock
          </button>
          <button 
            className={`button ${currentView === 'addDelivery' ? 'active' : ''}`}
            onClick={() => handleViewChange('addDelivery')}
          >
            Add Delivery
          </button>
          <button 
            className={`button ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => handleViewChange('history')}
          >
            Delivery History
          </button>
        </nav>
      </div>

      <div className="goods-content">
        {renderCurrentView()}
      </div>
    </div>
  );
}

export default Goods;