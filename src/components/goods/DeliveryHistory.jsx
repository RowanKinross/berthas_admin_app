import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from '@firebase/firestore';
import { db } from '../firebase/firebase';

function DeliveryHistory() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDelivery, setExpandedDelivery] = useState(null);

  // Fetch deliveries from Firestore
  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const q = query(collection(db, 'deliveries'), orderBy('dateCreated', 'desc'));
        const querySnapshot = await getDocs(q);
        const deliveriesData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          dateCreated: doc.data().dateCreated?.toDate() // Convert Firestore timestamp to Date
        }));
        setDeliveries(deliveriesData);
      } catch (error) {
        console.error("Error fetching deliveries:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeliveries();
  }, []);

  const toggleExpanded = (deliveryId) => {
    setExpandedDelivery(expandedDelivery === deliveryId ? null : deliveryId);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">Loading delivery history...</div>;
  }

  if (deliveries.length === 0) {
    return (
      <div className="delivery-history">
        <h3>Delivery History</h3>
        <div className="no-deliveries">
          <p>No deliveries recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-history">
      <h3>Delivery History</h3>
      <div className="deliveries-list">
        {deliveries.map(delivery => (
          <div key={delivery.id} className="delivery-card">
            <div 
              className="delivery-header" 
              onClick={() => toggleExpanded(delivery.id)}
            >
              <div className="delivery-summary">
                <h4>{delivery.supplier || 'Unknown Supplier'}</h4>
                <div className="delivery-meta">
                  <span className="delivery-date">{formatDate(new Date(delivery.deliveryDate))}</span>
                  <span className="po-number">PO: {delivery.poNumber || 'N/A'}</span>
                  <span className="goods-count">
                    {delivery.selectedGoods?.length || 0} item{delivery.selectedGoods?.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className={`expand-icon ${expandedDelivery === delivery.id ? 'expanded' : ''}`}>
                ▼
              </div>
            </div>
            
            {expandedDelivery === delivery.id && (
              <div className="delivery-details">

                
                {delivery.selectedGoods && delivery.selectedGoods.length > 0 && (
                  <div className="goods-details">
                    <div >
                      {delivery.selectedGoods.map(good => (
                        <div key={good} className="good-item">
                          <div className="good-name">{good}:</div>
                          <div className="good-details">
                            {delivery.quantities && delivery.quantities[good] && (
                              <div className="detail-item">
                                <span className="detail-label">Qty:</span>
                                <span className="detail-value">{delivery.quantities[good]}</span>
                              </div>
                            )}
                            {delivery.batchCodes && delivery.batchCodes[good] && (
                              <div className="detail-item">
                                <span className="detail-label">Batch:</span>
                                <span className="detail-value">{delivery.batchCodes[good]}</span>
                              </div>
                            )}
                            {delivery.temperatures && delivery.temperatures[good] && (
                              <div className="detail-item">
                                <span className="detail-label">Temp:</span>
                                <span className="detail-value">{delivery.temperatures[good]}</span>
                              </div>
                            )}
                            {delivery.useByDates && delivery.useByDates[good] && (
                              <div className="detail-item">
                                <span className="detail-label">Use by:</span>
                                <span className="detail-value">{formatDate(new Date(delivery.useByDates[good]))}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="delivery-info">
                  <div className="info-row">
                    <strong>Quality Checked:</strong> 
                    <span className={`status ${delivery.deliveryChecksComplete ? 'completed' : 'pending'}`}>
                      {delivery.deliveryChecksComplete ? ' ✓' : ' ✗'}
                    </span>
                  </div>
                </div>
                <div className="delivery-info">
                  {delivery.staffInitials && (
                    <div className="info-row">
                      <strong>Checked by:</strong> 
                      <span className="staffInitials">{delivery.staffInitials}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeliveryHistory;