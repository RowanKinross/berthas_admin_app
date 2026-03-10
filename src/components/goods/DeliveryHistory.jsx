import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from '@firebase/firestore';
import { db } from '../firebase/firebase';

// Component to render visual packaging indicators
const PackagingIcon = ({ packaging, ingredientName, size = 'normal' }) => {
  const getIconType = (packaging) => {
    const pack = packaging.toLowerCase();
    if (pack.includes('tin') || pack.includes('can')) return 'tin';
    if (pack.includes('box') || pack.includes('packet')) return 'box';
    if (pack.includes('bag')) return 'bag';
    if (pack.includes('sack')) return 'sack';
    if (pack.includes('pack')) return 'pack';
    if (pack.includes('kg')) return 'kg';
    if (pack.includes('bottle')) return 'bottle';
    if (pack.includes('jar')) return 'jar';
    if (pack.includes('bucket')) return 'bucket';
    if (pack.includes('tray')) return 'tray';
    return 'box'; // default
  };

  const getSVGPath = (type, ingredientName) => {
    switch (type) {
      case 'tin':
        return '/Tin.svg';
      case 'box':
        const name = ingredientName.toLowerCase();
        if (name.includes('basil')) return '/box_basil.svg';
        return '/box.svg';
      case 'bag':
        return '/Bag.svg';
      case 'bottle':
        return '/Bottle.svg';
      case 'jar':
        return '/Jar.svg';
      case 'bucket':
        return '/Bucket.svg';
      case 'tray':
        return '/Tray.svg';
      case 'sack': {
        const name = ingredientName.toLowerCase();
        if (name.includes('rye')) return '/Sack_rye.svg';
        if (name.includes('wholemeal')) return '/Sack_rye.svg';
        if (name.includes('caputo') && name.includes('blue')) return '/Sack_blue.svg';
        if (name.includes('caputo') && name.includes('red')) return '/Sack_red.svg';
        return '/Sack_plain.svg'; // default sack
      }
      case 'pack': {
        return '/box.svg'; // fallback to box for other packs
      }
      case 'kg': {
        const name = ingredientName.toLowerCase();
        if (name.includes('onion')) return '/box_onion.svg';
        if (name.includes('pepperoni') || name.includes('pepp')) return '/Pack_pepp.svg';
        if (name.includes('gran duro') || name.includes('gduro') || name.includes('grana duro') || name.includes('duro')) return '/Pack_GDuro.svg';
        if (name.includes('ham')) return '/Pack_ham.svg';
        if (name.includes('chillies')) return '/Sack_chilli.svg';
        return '/box.svg'; // fallback to box for other kg items
      }
      default:
        return '/box.svg';
    }
  };

  const iconType = getIconType(packaging);
  const svgPath = getSVGPath(iconType, ingredientName);
  const isSmall = size === 'small';
  const iconWidth = isSmall ? '20px' : '40px';
  const iconHeight = isSmall ? '25px' : '50px';
  
  return (
    <div style={{ 
      display: 'inline-block', 
      marginRight: '8px',
      verticalAlign: 'middle',
      width: iconWidth,
      height: iconHeight
    }}>
      <img 
        src={svgPath} 
        alt={iconType} 
        style={{ width: iconWidth, height: iconHeight }} 
        title={packaging}
      />
    </div>
  );
};

function DeliveryHistory() {
  const [deliveries, setDeliveries] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDelivery, setExpandedDelivery] = useState(null);

  // Fetch deliveries from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch deliveries
        const q = query(collection(db, 'deliveries'), orderBy('dateCreated', 'desc'));
        const querySnapshot = await getDocs(q);
        const deliveriesData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          dateCreated: doc.data().dateCreated?.toDate() // Convert Firestore timestamp to Date
        }));
        setDeliveries(deliveriesData);

        // Fetch ingredients for icon display
        const ingredientsSnapshot = await getDocs(collection(db, 'ingredients'));
        const ingredientsData = ingredientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIngredients(ingredientsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const getIngredientData = (ingredientName) => {
    return ingredients.find(ingredient => ingredient.name === ingredientName);
  };

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
                      {delivery.selectedGoods.map(good => {
                        const ingredientData = getIngredientData(good);
                        return (
                        <div key={good} className="good-item">
                          <div className="good-name" style={{ display: 'flex', alignItems: 'center' }}>
                            {ingredientData?.packaging && (
                              <PackagingIcon 
                                packaging={ingredientData.packaging} 
                                ingredientName={good} 
                                size="small" 
                              />
                            )}
                            {good}:
                          </div>
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
                        );
                      })}
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