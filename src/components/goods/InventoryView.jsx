import React, { useState, useEffect } from 'react';
import { collection, getDocs } from '@firebase/firestore';
import { db } from '../firebase/firebase';

function InventoryView() {
  const [inventory, setInventory] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name'); // name, quantity, expiry
  const [filterExpiring, setFilterExpiring] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch ingredients
        const ingredientsSnapshot = await getDocs(collection(db, 'ingredients'));
        const ingredientsData = ingredientsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setIngredients(ingredientsData);

        // Fetch deliveries
        const deliveriesSnapshot = await getDocs(collection(db, 'deliveries'));
        const deliveriesData = deliveriesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // Calculate inventory levels
        const inventoryMap = {};
        
        deliveriesData.forEach(delivery => {
          if (delivery.selectedGoods && Array.isArray(delivery.selectedGoods)) {
            delivery.selectedGoods.forEach(goodName => {
              if (!inventoryMap[goodName]) {
                inventoryMap[goodName] = {
                  name: goodName,
                  totalQuantity: 0,
                  batches: [],
                  packaging: ingredientsData.find(ing => ing.name === goodName)?.packaging || 'units'
                };
              }
              
              const quantity = delivery.quantities && delivery.quantities[goodName] 
                ? parseInt(delivery.quantities[goodName]) || 0 
                : 0;
              
              inventoryMap[goodName].totalQuantity += quantity;
              
              if (quantity > 0) {
                inventoryMap[goodName].batches.push({
                  batchCode: delivery.batchCodes?.[goodName] || 'N/A',
                  quantity: quantity,
                  useByDate: delivery.useByDates?.[goodName] || null,
                  temperature: delivery.temperatures?.[goodName] || 'N/A',
                  deliveryDate: delivery.deliveryDate,
                  supplier: delivery.supplier || 'Unknown'
                });
              }
            });
          }
        });

        // Convert to array and sort batches by use-by date
        const inventoryArray = Object.values(inventoryMap).map(item => ({
          ...item,
          batches: item.batches.sort((a, b) => {
            if (!a.useByDate) return 1;
            if (!b.useByDate) return -1;
            return new Date(a.useByDate) - new Date(b.useByDate);
          }),
          earliestExpiry: item.batches.find(batch => batch.useByDate)?.useByDate || null
        }));

        setInventory(inventoryArray);
      } catch (error) {
        console.error("Error fetching inventory data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (dateString, daysThreshold = 7) => {
    if (!dateString) return false;
    const expiryDate = new Date(dateString);
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= daysThreshold && diffDays >= 0;
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    const expiryDate = new Date(dateString);
    const today = new Date();
    return expiryDate < today;
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    switch (sortBy) {
      case 'quantity':
        return b.totalQuantity - a.totalQuantity;
      case 'expiry':
        if (!a.earliestExpiry) return 1;
        if (!b.earliestExpiry) return -1;
        return new Date(a.earliestExpiry) - new Date(b.earliestExpiry);
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const filteredInventory = filterExpiring 
    ? sortedInventory.filter(item => 
        item.earliestExpiry && (isExpiringSoon(item.earliestExpiry) || isExpired(item.earliestExpiry))
      )
    : sortedInventory;

  if (loading) {
    return <div className="loading">Loading inventory...</div>;
  }

  return (
    <div className="inventory-view">
      <div className="inventory-header">
        <h3>Current Inventory</h3>
        <div className="inventory-controls">
          <div className="filter-controls">
            <label>
              <input
                type="checkbox"
                checked={filterExpiring}
                onChange={(e) => setFilterExpiring(e.target.checked)}
              />
              Show expiring items only
            </label>
          </div>
          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Name</option>
              <option value="quantity">Quantity</option>
              <option value="expiry">Expiry Date</option>
            </select>
          </div>
        </div>
      </div>

      {filteredInventory.length === 0 ? (
        <div className="no-inventory">
          <p>{filterExpiring ? 'No items expiring soon.' : 'No inventory items found.'}</p>
        </div>
      ) : (
        <div className="inventory-grid">
          {filteredInventory.map(item => (
            <div key={item.name} className="inventory-item">
              <div className="item-header">
                <h4>{item.name}</h4>
                <div className="total-quantity">
                  <span className="quantity">{item.totalQuantity}</span>
                  <span className="unit">{item.packaging}</span>
                </div>
              </div>
              
              {item.batches.length > 0 && (
                <div className="batches-section">
                  <h5>Batches:</h5>
                  <div className="batches-list">
                    {item.batches.map((batch, index) => {
                      const isExpiringBatch = isExpiringSoon(batch.useByDate);
                      const isExpiredBatch = isExpired(batch.useByDate);
                      
                      return (
                        <div 
                          key={`${batch.batchCode}-${index}`} 
                          className={`batch-item ${isExpiredBatch ? 'expired' : isExpiringBatch ? 'expiring' : ''}`}
                        >
                          <div className="batch-info">
                            <div className="batch-main">
                              <span className="batch-code">Batch: {batch.batchCode}</span>
                              <span className="batch-quantity">{batch.quantity} {item.packaging}</span>
                            </div>
                            <div className="batch-details">
                              <span className="use-by">
                                Use by: {formatDate(batch.useByDate)}
                                {isExpiredBatch && <span className="status-tag expired">EXPIRED</span>}
                                {isExpiringBatch && !isExpiredBatch && <span className="status-tag expiring">EXPIRING</span>}
                              </span>
                              <span className="supplier">Supplier: {batch.supplier}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InventoryView;