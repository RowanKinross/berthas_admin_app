import React, { useState, useEffect, useMemo } from 'react';
import './BatchBuilderModal.css';

function BatchBuilderModal({ 
  isOpen, 
  onClose, 
  stockSummary, 
  plannedSummary, 
  pizzas, 
  averageOrdering,
  averageOrderingPercent
}) {
  const [testInputs, setTestInputs] = useState({});
  const [showCurrentStockQuantity, setShowCurrentStockQuantity] = useState(false);
  const [showProjectedTotalQuantity, setShowProjectedTotalQuantity] = useState(false);

  // Initialize test inputs when modal opens
  useEffect(() => {
    if (isOpen && plannedSummary) {
      const initialInputs = {};
      plannedSummary.forEach(item => {
        if (!item.isGap) {
          initialInputs[item.id] = {
            w1: item.stockNumbers?.w1 || 0,
            w2: item.stockNumbers?.w2 || 0,
            w3: item.stockNumbers?.w3 || 0
          };
        }
      });
      setTestInputs(initialInputs);
    }
  }, [isOpen, plannedSummary]);

  // Calculate the projected stock levels with test values
  const projectedData = useMemo(() => {
    if (!plannedSummary || !testInputs) return [];

    // Calculate sleeve totals with test data
    const testSleeveTotals = { '0': { stock: 0, w1: 0, w2: 0, w3: 0 }, '1': { stock: 0, w1: 0, w2: 0, w3: 0 } };
    
    return plannedSummary.map(item => {
      if (item.isGap) return item;

      const testValues = testInputs[item.id] || { w1: 0, w2: 0, w3: 0 };
      
      // Calculate new cumulative values
      const projectedStock = {
        current: item.total,
        w1: item.total + testValues.w1,
        w2: item.total + testValues.w1 + testValues.w2,
        w3: item.total + testValues.w1 + testValues.w2 + testValues.w3
      };

      // Calculate sleeve totals for percentage calculations
      if (item.sleeveType === '0' || item.sleeveType === '1') {
        testSleeveTotals[item.sleeveType].stock += item.total;
        testSleeveTotals[item.sleeveType].w1 += testValues.w1;
        testSleeveTotals[item.sleeveType].w2 += testValues.w2;
        testSleeveTotals[item.sleeveType].w3 += testValues.w3;
      }

      return {
        ...item,
        testValues,
        projectedStock
      };
    });
  }, [plannedSummary, testInputs]);

  // Calculate projected ratios
  const projectedRatios = useMemo(() => {
    if (!projectedData) return {};

    const testSleeveTotals = { '0': { stock: 0, w1: 0, w2: 0, w3: 0 }, '1': { stock: 0, w1: 0, w2: 0, w3: 0 } };
    
    // First pass: calculate sleeve totals
    projectedData.forEach(item => {
      if (!item.isGap && (item.sleeveType === '0' || item.sleeveType === '1')) {
        testSleeveTotals[item.sleeveType].stock += item.total || 0;
        testSleeveTotals[item.sleeveType].w1 += item.testValues?.w1 || 0;
        testSleeveTotals[item.sleeveType].w2 += item.testValues?.w2 || 0;
        testSleeveTotals[item.sleeveType].w3 += item.testValues?.w3 || 0;
      }
    });

    // Second pass: calculate ratios
    const ratios = {};
    projectedData.forEach(item => {
      if (!item.isGap && item.sleeveType && (item.sleeveType === '0' || item.sleeveType === '1')) {
        const sleeve = testSleeveTotals[item.sleeveType];
        const denominators = {
          current: sleeve.stock || 1,
          w1: (sleeve.stock + sleeve.w1) || 1,
          w2: (sleeve.stock + sleeve.w1 + sleeve.w2) || 1,
          w3: (sleeve.stock + sleeve.w1 + sleeve.w2 + sleeve.w3) || 1
        };

        ratios[item.id] = {
          current: Math.round((item.total / denominators.current) * 100),
          w1: Math.round((item.projectedStock.w1 / denominators.w1) * 100),
          w2: Math.round((item.projectedStock.w2 / denominators.w2) * 100),
          w3: Math.round((item.projectedStock.w3 / denominators.w3) * 100)
        };
      }
    });

    return ratios;
  }, [projectedData]);

  // Check if any changes have been made from original values
  const hasChanges = useMemo(() => {
    if (!plannedSummary || !testInputs) return false;
    
    return plannedSummary.some(item => {
      if (item.isGap) return false;
      
      const currentInputs = testInputs[item.id];
      const originalValues = {
        w1: item.stockNumbers?.w1 || 0,
        w2: item.stockNumbers?.w2 || 0,
        w3: item.stockNumbers?.w3 || 0
      };
      
      return currentInputs && (
        currentInputs.w1 !== originalValues.w1 ||
        currentInputs.w2 !== originalValues.w2 ||
        currentInputs.w3 !== originalValues.w3
      );
    });
  }, [testInputs, plannedSummary]);

  const handleInputChange = (pizzaId, week, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setTestInputs(prev => ({
      ...prev,
      [pizzaId]: {
        ...prev[pizzaId],
        [week]: numValue
      }
    }));
  };

  const resetInputs = () => {
    if (plannedSummary) {
      const initialInputs = {};
      plannedSummary.forEach(item => {
        if (!item.isGap) {
          initialInputs[item.id] = {
            w1: item.stockNumbers?.w1 || 0,
            w2: item.stockNumbers?.w2 || 0,
            w3: item.stockNumbers?.w3 || 0
          };
        }
      });
      setTestInputs(initialInputs);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="batch-builder-overlay">
      <div className="batch-builder-modal">
        <div className="batch-builder-header">
          <button className="close-button" onClick={onClose}>×</button>
          <h3>Batch Builder</h3>
        </div>
        
        <div className="batch-builder-content">
          <div className="controls">
            {hasChanges && (
              <button className="reset-button" onClick={resetInputs}>Reset to Current</button>
            )}
          </div>

          <div className="batch-builder-table-container">
            <table className="batch-builder-table">
              <thead>
                <tr>
                  <th>Pizza</th>
                  <th 
                    onClick={() => setShowCurrentStockQuantity(!showCurrentStockQuantity)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to toggle between % and quantity"
                  >
                    Current Stock {showCurrentStockQuantity ? '(qty)' : '(%)'}
                  </th>
                  <th>Week 1 Planned</th>
                  <th>Week 2 Planned</th>
                  <th>Week 3 Planned</th>
                  <th 
                    onClick={() => setShowProjectedTotalQuantity(!showProjectedTotalQuantity)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to toggle between % and quantity"
                  >
                    Projected Total {showProjectedTotalQuantity ? '(qty)' : '(%)'}
                  </th>
                  <th>Projected Weeks</th>
                  <th>Aim</th>
                </tr>
              </thead>
              <tbody>
                {projectedData.map((item, i) => {
                  if (item.isGap) {
                    return (
                      <tr key={`gap-${i}`} className="gap-row">
                        <td colSpan="8" className="gap-cell"></td>
                      </tr>
                    );
                  }

                  const ratios = projectedRatios[item.id] || {};
                  const avgPercent = averageOrderingPercent[item.id];
                  
                  // Calculate projected weeks: total projected quantity / average weekly orders
                  const avgWeeklyOrders = averageOrdering[item.id] || 0;
                  let projectedQuantity;
                  
                  if (item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1') {
                    // For base items, use the direct quantity
                    projectedQuantity = item.projectedStock?.w3 || 0;
                  } else {
                    // For sleeve items, calculate quantity from percentage ratio
                    // We need the total sleeve quantity projected at w3
                    const testSleeveTotals = { '0': 0, '1': 0 };
                    projectedData.forEach(dataItem => {
                      if (!dataItem.isGap && (dataItem.sleeveType === '0' || dataItem.sleeveType === '1')) {
                        const testValues = testInputs[dataItem.id] || { w1: 0, w2: 0, w3: 0 };
                        testSleeveTotals[dataItem.sleeveType] += (dataItem.total || 0) + testValues.w1 + testValues.w2 + testValues.w3;
                      }
                    });
                    const sleeveTotal = testSleeveTotals[item.sleeveType] || 1;
                    const ratio = ratios.w3 || 0;
                    projectedQuantity = Math.round((ratio / 100) * sleeveTotal);
                  }
                  
                  const projectedWeeks = avgWeeklyOrders > 0 ? (projectedQuantity / avgWeeklyOrders).toFixed(1) : '-';

                  return (
                    <tr key={item.id} style={{ backgroundColor: `${item.color}20` }}>
                      <td>
                        <span 
                          className="pizza-id-cell"
                          style={{ backgroundColor: `${item.color}60` }}
                        >
                          {item.name}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          if (item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1') {
                            // Base items always show quantity
                            return item.total;
                          } else {
                            // Sleeve items: show quantity or percentage based on toggle
                            if (showCurrentStockQuantity) {
                              // Calculate current stock quantity from percentage
                              const currentSleeveTotals = { '0': 0, '1': 0 };
                              (stockSummary || []).forEach(stockItem => {
                                if (stockItem.sleeveType === '0' || stockItem.sleeveType === '1') {
                                  currentSleeveTotals[stockItem.sleeveType] += stockItem.total || 0;
                                }
                              });
                              const sleeveTotal = currentSleeveTotals[item.sleeveType] || 1;
                              const ratio = ratios.current || item.ratio || 0;
                              return Math.round((ratio / 100) * sleeveTotal);
                            } else {
                              return `${ratios.current || item.ratio}%`;
                            }
                          }
                        })()} 
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={testInputs[item.id]?.w1 || 0}
                          onChange={(e) => handleInputChange(item.id, 'w1', e.target.value)}
                          className="week-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={testInputs[item.id]?.w2 || 0}
                          onChange={(e) => handleInputChange(item.id, 'w2', e.target.value)}
                          className="week-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={testInputs[item.id]?.w3 || 0}
                          onChange={(e) => handleInputChange(item.id, 'w3', e.target.value)}
                          className="week-input"
                        />
                      </td>
                      <td>
                        {(() => {
                          if (item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1') {
                            // Base items always show quantity
                            return item.projectedStock?.w3 || 0;
                          } else {
                            // Sleeve items: show quantity or percentage based on toggle
                            if (showProjectedTotalQuantity) {
                              // Use the projectedQuantity already calculated above
                              return projectedQuantity;
                            } else {
                              return `${ratios.w3 || 0}%`;
                            }
                          }
                        })()} 
                      </td>
                      <td>
                        {avgWeeklyOrders > 0 ? `${projectedWeeks}wks` : '-'}
                      </td>
                      <td>
                        {avgPercent != null && avgPercent !== '' ? `${avgPercent}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BatchBuilderModal;