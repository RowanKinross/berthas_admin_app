import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import './MixCalculator.css';

const MixCalculator = ({ onTotalsChange, onQuantitiesChange, batchId, initialQuantities, hideResults = false }) => {
  // State for starter percentage toggle (true = 3%, false = 2.5%)
  const [isThreePercent, setIsThreePercent] = useState(true);

  // Mix size data - split into fixed and variable groups
  const getFixedMixSizes = () => [
    { name: 'Top up:', water: 300, starter: 80, rye: 215, caputo: 215 },
    { name: '30kg Dough Balls (10%):', water: 1120, starter: 280, rye: 800, caputo: 800 }
  ];

  const getVariableMixSizes = () => [
    { 
      name:  '50kg', 
      water: isThreePercent ? 560 : 465, 
      starter: isThreePercent ? 150 : 125, 
      rye: isThreePercent ? 400 : 330, 
      caputo: isThreePercent ? 400 : 330 
    },
    { 
      name: '45kg', 
      water: isThreePercent ? 510 : 420, 
      starter: isThreePercent ? 135 : 115, 
      rye: isThreePercent ? 360 : 300, 
      caputo: isThreePercent ? 360 : 300 
    },
    { 
      name:'35kg', 
      water: isThreePercent? 400: 325, 
      starter: isThreePercent ? 110 : 90, 
      rye: isThreePercent ? 275 : 230, 
      caputo: isThreePercent ? 275 : 230 
    },
    { 
      name:'30kg', 
      water: isThreePercent ? 340 : 280, 
      starter: isThreePercent ? 90 : 70, 
      rye: isThreePercent ? 240 : 200, 
      caputo: isThreePercent ? 240 : 200 
    },
    { 
      name:'15kg', 
      water: isThreePercent? 170 : 140, 
      starter: isThreePercent ? 45 : 35, 
      rye: isThreePercent ? 120 : 100, 
      caputo: isThreePercent ? 120 : 100 
    }
  ];

  const fixedMixSizes = getFixedMixSizes();
  const variableMixSizes = getVariableMixSizes();

  // State for quantities of each mix size - separate frozen and restaurant
  const [quantities, setQuantities] = useState({
    'Top up': 1,
    '30kg Dough Balls (10%)': 0
  });
  
  const [frozenQuantities, setFrozenQuantities] = useState({
    '50kg': 0,
    '45kg': 0,
    '35kg': 0,
    '30kg': 0,
    '15kg': 0
  });
  
  const [restaurantQuantities, setRestaurantQuantities] = useState({
    '50kg': 0,
    '45kg': 0,
    '35kg': 0,
    '30kg': 0,
    '15kg': 0
  });

  // Get quantity for fixed sizes (Top up, 30kg Dough Balls)
  const getFixedQuantity = (sizeName) => {
    // Remove colon from size name to match quantities keys
    const keyName = sizeName.replace(':', '');
    return quantities[keyName] || 0;
  };
  
  // Get quantity for frozen sizes
  const getFrozenQuantity = (sizeName) => {
    const baseName = sizeName.split(' (')[0];
    return frozenQuantities[baseName] || 0;
  };
  
  // Get quantity for restaurant sizes
  const getRestaurantQuantity = (sizeName) => {
    const baseName = sizeName.split(' (')[0];
    return restaurantQuantities[baseName] || 0;
  };

  const handleFixedQuantityChange = (sizeName, value) => {
    setQuantities(prev => ({
      ...prev,
      [sizeName]: parseInt(value) || 0
    }));
  };
  
  const handleFrozenQuantityChange = (sizeName, value) => {
    const baseName = sizeName.split(' (')[0];
    setFrozenQuantities(prev => ({
      ...prev,
      [baseName]: parseInt(value) || 0
    }));
  };
  
  const handleRestaurantQuantityChange = (sizeName, value) => {
    const baseName = sizeName.split(' (')[0];
    setRestaurantQuantities(prev => ({
      ...prev,
      [baseName]: parseInt(value) || 0
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const totals = { water: 0, starter: 0, rye: 0, caputo: 0 };
    
    // Add fixed mix sizes
    fixedMixSizes.forEach(size => {
      const qty = getFixedQuantity(size.name);
      totals.water += size.water * qty;
      totals.starter += size.starter * qty;
      totals.rye += size.rye * qty;
      totals.caputo += size.caputo * qty;
    });
    
    // Add frozen quantities
    variableMixSizes.forEach(size => {
      const qty = getFrozenQuantity(size.name);
      totals.water += size.water * qty;
      totals.starter += size.starter * qty;
      totals.rye += size.rye * qty;
      totals.caputo += size.caputo * qty;
    });
    
    // Add restaurant quantities
    variableMixSizes.forEach(size => {
      const qty = getRestaurantQuantity(size.name);
      totals.water += size.water * qty;
      totals.starter += size.starter * qty;
      totals.rye += size.rye * qty;
      totals.caputo += size.caputo * qty;
    });
    
    return totals;
  };

  const totals = calculateTotals();

  // Update parent component when totals change
  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange(totals);
    }
  }, [totals, onTotalsChange]);

  // Update parent component when quantities change
  useEffect(() => {
    if (onQuantitiesChange) {
      const allQuantities = {
        isThreePercent,
        fixedQuantities: quantities,
        frozenQuantities,
        restaurantQuantities,
        totals
      };
      onQuantitiesChange(allQuantities);
    }
  }, [quantities, frozenQuantities, restaurantQuantities, isThreePercent, totals, onQuantitiesChange]);

  // Initialize from props if provided
  useEffect(() => {
    if (initialQuantities) {
      if (initialQuantities.isThreePercent !== undefined) {
        setIsThreePercent(initialQuantities.isThreePercent);
      }
      if (initialQuantities.fixedQuantities) {
        setQuantities(initialQuantities.fixedQuantities);
      }
      if (initialQuantities.frozenQuantities) {
        setFrozenQuantities(initialQuantities.frozenQuantities);
      }
      if (initialQuantities.restaurantQuantities) {
        setRestaurantQuantities(initialQuantities.restaurantQuantities);
      }
    }
  }, [initialQuantities]);

  const hasAnyQuantity = Object.values(quantities).some(qty => qty > 0) || 
                         Object.values(frozenQuantities).some(qty => qty > 0) ||
                         Object.values(restaurantQuantities).some(qty => qty > 0);

  return (
    <div className="mix-calculator-container">
      {/* Top Up */}
      <div className="mix-input-row">
        <Form.Label className="mix-size-label">
          Top Up:
        </Form.Label>
        <Form.Control
          type="number"
          min="0"
          value={getFixedQuantity('Top up')}
          onChange={(e) => handleFixedQuantityChange('Top up', e.target.value)}
          className="mix-input"
        />
      </div>
      
      {/* Separator Line */}
      <hr className="mix-separator" />
      
      {/* Starter Percentage Toggle (for variable sizes only) */}
      <div className="starter-toggle-container">
        <div><strong>Starter Percentage:</strong></div>
        <Form.Check
          type="radio"
          id="starter-3-percent"
          name="starter-percentage"
          label="3%"
          checked={isThreePercent}
          onChange={() => setIsThreePercent(true)}
          className="starter-radio"
          inline
        />
        <Form.Check
          type="radio"
          id="starter-2-5-percent"
          name="starter-percentage"
          label="2.5%"
          checked={!isThreePercent}
          onChange={() => setIsThreePercent(false)}
          className="starter-radio"
          inline
        />
      </div>
      
      {/* Variable Mix Sizes (affected by radio selection) */}
      <div className="mix-input-column">
        <div> <strong> Frozen:</strong></div>
        {variableMixSizes.map(size => (
          <div key={size.name} className="mix-input-row">
            <Form.Label className="mix-input-label">
              {size.name}
            </Form.Label>
            <Form.Control
              type="number"
              min="0"
              value={getFrozenQuantity(size.name)}
              onChange={(e) => handleFrozenQuantityChange(size.name, e.target.value)}
              className="mix-input"
            />
          </div>
        ))}
      </div>
      <div className="mix-input-column">
        <div> <strong> Restaurant:</strong></div>
        {variableMixSizes.map(size => (
          <div key={size.name} className="mix-input-row">
            <Form.Label className="mix-input-label">
              {size.name}
            </Form.Label>
            <Form.Control
              type="number"
              min="0"
              value={getRestaurantQuantity(size.name)}
              onChange={(e) => handleRestaurantQuantityChange(size.name, e.target.value)}
              className="mix-input"
            />
          </div>
        ))}
      </div>
      
      {/* Separator Line */}
      <hr className="mix-separator" />
      
      {/* 30kg Dough Balls */}
      <div className="mix-input-row">
        <Form.Label className="mix-size-label">
          30kg Dough Balls (10%):
        </Form.Label>
        <Form.Control
          type="number"
          min="0"
          value={getFixedQuantity('30kg Dough Balls (10%)')}
          onChange={(e) => handleFixedQuantityChange('30kg Dough Balls (10%)', e.target.value)}
          className="mix-input"
        />
      </div>

      {/* Results Column */}
      {hasAnyQuantity && !hideResults && (
        <div className="mix-results-section">
          <div className="mix-results-column">
            <div className="mix-result-item">
              <strong>70% Water: {totals.water.toLocaleString()}g</strong>
            </div>
            <div className="mix-result-item">
              <strong>19% Starter: {totals.starter.toLocaleString()}g</strong>
            </div>
            <div className="mix-result-item">
              <strong>50% Rye: {totals.rye.toLocaleString()}g</strong>
            </div>
            <div className="mix-result-item">
              <strong>50% Caputo: {totals.caputo.toLocaleString()}g</strong>
            </div>
          </div>
        </div>
      )}

      {/* Quick Example */}
      {!hasAnyQuantity && (
        <div className="mix-example-text">
          Enter quantities above to calculate starter size needed
          e.g 1 x Top up + 3 × 45kg + 1 × 50kg
        </div>
      )}
    </div>
  );
};

export default MixCalculator;