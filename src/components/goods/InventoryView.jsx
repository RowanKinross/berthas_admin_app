import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from '@firebase/firestore';
import { db } from '../firebase/firebase';

// Component to render visual quantity indicators
const QuantityVisual = ({ quantity, packaging, ingredientName, size = 'normal' }) => {
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

  const renderIcon = (type, fillPercentage = 100, ingredientName = '') => {
    const svgPath = getSVGPath(type, ingredientName);
    const isSmall = size === 'small';
    const iconWidth = isSmall ? '20px' : '40px';
    const iconHeight = isSmall ? '25px' : '50px';
    const margin = isSmall ? '-2px' : '-4px';
    
    return (
      <div style={{ 
        position: 'relative', 
        display: 'inline-block', 
        margin: margin,
        width: iconWidth,
        height: iconHeight
      }}>
        {fillPercentage === 0 ? (
          // Gray version for empty
          <img 
            src={svgPath} 
            alt={type} 
            style={{ 
              width: iconWidth, 
              height: iconHeight,
              filter: 'grayscale(100%) brightness(0.8)'
            }} 
          />
        ) : fillPercentage === 100 ? (
          // Normal colored version for full
          <img 
            src={svgPath} 
            alt={type} 
            style={{ width: iconWidth, height: iconHeight }} 
          />
        ) : (
          // Partial fill version
          <>
            <img 
              src={svgPath} 
              alt={type} 
              style={{ 
                width: iconWidth, 
                height: iconHeight,
                filter: 'grayscale(100%) brightness(0.8)'
              }} 
            />
            <img 
              src={svgPath} 
              alt={type} 
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: iconWidth, 
                height: iconHeight,
                clipPath: `inset(0 ${100 - fillPercentage}% 0 0)`
              }} 
            />
          </>
        )}
      </div>
    );
  };
  const iconType = getIconType(packaging);
  
  // Special handling for oregano and chillies - convert grams to box units (1000g = 1 box)
  let displayQuantity = quantity;
  const name = ingredientName.toLowerCase();
  if (name.includes('oregano') || name.includes('chilli')) {
    displayQuantity = quantity / 1000;
  }
  
  const wholeUnits = Math.floor(displayQuantity);
  const fractionalPart = displayQuantity - wholeUnits;
  const totalQuantity = fractionalPart > 0 ? wholeUnits + 1 : wholeUnits;
  
  // If we have more than 50 units, show "50+" instead
  if (totalQuantity > 50) {
    const firstRowIcons = Array.from({ length: 8 }, (_, i) => renderIcon(iconType, 100, ingredientName));
    const secondRowIcons = Array.from({ length: 8 }, (_, i) => renderIcon(iconType, 100, ingredientName));
    const thirdRowIcons = Array.from({ length: 8 }, (_, i) => renderIcon(iconType, 100, ingredientName));
    const fourthRowIcons = Array.from({ length: 8 }, (_, i) => renderIcon(iconType, 100, ingredientName));
    const fifthRowIcons = Array.from({ length: 8 }, (_, i) => renderIcon(iconType, 100, ingredientName));
    
    const isSmall = size === 'small';
    const rowOverlap = isSmall ? '-15px' : '-30px';
    const horizontalOffset = isSmall ? '8px' : '16px';
    
    return (
      <div style={{ position: 'relative', marginTop: '8px' }}>
        {/* First row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {firstRowIcons}
        </div>
        {/* Second row overlapping */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: rowOverlap, marginLeft: horizontalOffset }}>
          {secondRowIcons}
        </div>
        {/* Third row overlapping */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: rowOverlap, marginLeft: '0px' }}>
          {thirdRowIcons}
        </div>
        {/* Fourth row overlapping */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: rowOverlap, marginLeft: horizontalOffset }}>
          {fourthRowIcons}
        </div>
        {/* Fifth row overlapping */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: rowOverlap, marginLeft: '0px' }}>
          {fifthRowIcons}
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#666', marginLeft: '5px' }}>+</span>
        </div>
      </div>
    );
  }

  const icons = [];
  
  // Add whole unit icons
  for (let i = 0; i < wholeUnits; i++) {
    icons.push(renderIcon(iconType, 100, ingredientName));
  }
  
  // Add fractional icon if there's a remainder
  if (fractionalPart > 0) {
    const fillPercentage = Math.round(fractionalPart * 100);
    icons.push(renderIcon(iconType, fillPercentage, ingredientName));
  }
  
  // Create overlapping rows after 8 icons
  const totalIcons = icons.length;
  if (totalIcons > 8) {
    const rows = [];
    for (let i = 0; i < totalIcons; i += 8) {
      rows.push(icons.slice(i, i + 8));
    }
    
    const isSmall = size === 'small';
    const rowOverlap = isSmall ? '-15px' : '-30px';
    const horizontalOffset = isSmall ? 8 : 16;
    
    return (
      <div style={{ position: 'relative', marginTop: '8px' }}>
        {rows.map((rowIcons, rowIndex) => (
          <div 
            key={rowIndex}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginTop: rowIndex > 0 ? rowOverlap : '0',
              marginLeft: `${rowIndex % 2 === 0 ? 0 : horizontalOffset}px`
            }}
          >
            {rowIcons.map((icon, index) => (
              <React.Fragment key={index + (rowIndex * 8)}>{icon}</React.Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', flexWrap: 'nowrap' }}>
      {icons.map((icon, index) => (
        <React.Fragment key={index}>{icon}</React.Fragment>
      ))}
      {displayQuantity === 0 && (
        <span style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>No stock</span>
      )}
    </div>
  );
};

function InventoryView() {
  const [inventory, setInventory] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name'); // name, quantity, expiry
  const [filterExpiring, setFilterExpiring] = useState(false);
  // selectedBatch uniquely identified by ingredientName, batchCode, and deliveryId
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [deliveriesData, setDeliveriesData] = useState([]);

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
        const deliveriesDataTemp = deliveriesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setDeliveriesData(deliveriesDataTemp);
        const deliveriesData = deliveriesDataTemp;

        // Extract allocations from deliveries
        const allocationsData = [];
        deliveriesData.forEach(delivery => {
          if (delivery.allocations && Array.isArray(delivery.allocations)) {
            delivery.allocations.forEach(allocation => {
              allocationsData.push({
                ingredientName: allocation.ingredientName,
                quantityUsed: allocation.quantityAllocated || 0,
                ingredientBatchCode: delivery.batchCodes?.[allocation.ingredientName] || 'N/A',
                allocatedToBatchId: allocation.allocatedToBatchId,
                allocatedToBatchCode: allocation.allocatedToBatchCode,
                allocationDate: allocation.allocationDate
              });
            });
          }
        });

        // Calculate inventory levels - start with all ingredients
        const inventoryMap = {};
        
        // Initialize all ingredients with zero stock
        ingredientsData.forEach(ingredient => {
          inventoryMap[ingredient.name] = {
            name: ingredient.name,
            totalQuantity: 0,
            batches: [],
            packaging: ingredient.packaging || 'units'
          };
        });
        
        // Now populate stock levels from deliveries
        deliveriesData.forEach(delivery => {
          if (delivery.selectedGoods && Array.isArray(delivery.selectedGoods)) {
            delivery.selectedGoods.forEach(goodName => {
              // Create entry for ingredients not in ingredients collection but in deliveries
              if (!inventoryMap[goodName]) {
                inventoryMap[goodName] = {
                  name: goodName,
                  totalQuantity: 0,
                  batches: [],
                  packaging: ingredientsData.find(ing => ing.name === goodName)?.packaging || 'units'
                };
              }
              
              const quantity = delivery.quantities && delivery.quantities[goodName] 
                ? parseFloat(delivery.quantities[goodName]) || 0 
                : 0;
              
              // Add found stock to the quantity
              const foundStock = delivery.foundStock && delivery.foundStock[goodName]
                ? parseFloat(delivery.foundStock[goodName]) || 0
                : 0;
              
              const totalQuantity = quantity + foundStock;
              
              inventoryMap[goodName].totalQuantity += totalQuantity;
              
              if (totalQuantity > 0) {
                inventoryMap[goodName].batches.push({
                  batchCode: delivery.batchCodes?.[goodName] || 'N/A',
                  quantity: totalQuantity,
                  originalQuantity: quantity,
                  foundStock: foundStock,
                  useByDate: delivery.useByDates?.[goodName] || null,
                  temperature: delivery.temperatures?.[goodName] || 'N/A',
                  deliveryDate: delivery.deliveryDate,
                  supplier: delivery.supplier || 'Unknown',
                  deliveryId: delivery.id
                });
              }
            });
          }
        });

        // Subtract allocations from inventory totals
        allocationsData.forEach(allocation => {
          const ingredientName = allocation.ingredientName;
          const quantityUsed = allocation.quantityUsed || 0;
          const batchCodeUsed = allocation.ingredientBatchCode;
          
          if (inventoryMap[ingredientName] && quantityUsed > 0) {
            // First try to subtract from the specific batch that was used
            const targetBatch = inventoryMap[ingredientName].batches.find(
              batch => batch.batchCode === batchCodeUsed
            );
            
            if (targetBatch && targetBatch.quantity >= quantityUsed) {
              targetBatch.quantity -= quantityUsed;
              inventoryMap[ingredientName].totalQuantity -= quantityUsed;
            } else {
              // If specific batch not found or insufficient, subtract from total
              inventoryMap[ingredientName].totalQuantity = Math.max(0, 
                inventoryMap[ingredientName].totalQuantity - quantityUsed
              );
              
              // Distribute the subtraction across available batches
              let remainingToSubtract = quantityUsed;
              for (const batch of inventoryMap[ingredientName].batches) {
                if (remainingToSubtract <= 0) break;
                const subtractFromThisBatch = Math.min(batch.quantity, remainingToSubtract);
                batch.quantity -= subtractFromThisBatch;
                remainingToSubtract -= subtractFromThisBatch;
              }
            }
          }
        });

        // Remove batches with zero quantity and filter out completely consumed ingredients
        Object.keys(inventoryMap).forEach(ingredientName => {
          inventoryMap[ingredientName].batches = inventoryMap[ingredientName].batches.filter(
            batch => batch.quantity > 0
          );
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

  // Close adjustment controls when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.batch-info') && !event.target.closest('.stock-adjustment-controls')) {
        setSelectedBatch(null);
      }
    };

    if (selectedBatch) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [selectedBatch]);

  // Helper function to get increment amount for "add found" button
  const getFoundIncrementAmount = (ingredientName) => {
    const name = ingredientName.toLowerCase();
    
    if (name.includes('chillies')) return 0.25; // 250g
    if (name.includes('rapeseed oil')) return 0.1; // 0.1 bottles
    if (name.includes('red onion')) return 0.25; // 0.25 kg
    if (name.includes('salt')) return 0.1; // 0.1 sacks
    
    return 1; // Default: 1 whole unit
  };

  const addFoundStock = async (ingredientName, batchCode) => {
    try {
      const amount = getFoundIncrementAmount(ingredientName);
      
      // Find the delivery that contains this batch
      const targetDelivery = deliveriesData.find(delivery => 
        delivery.batchCodes && delivery.batchCodes[ingredientName] === batchCode
      );

      if (!targetDelivery) {
        alert('Delivery not found for this batch');
        return;
      }

      // Update the delivery document with found stock
      const deliveryRef = doc(db, 'deliveries', targetDelivery.id);
      const currentFoundStock = targetDelivery.foundStock || {};
      const newFoundStock = {
        ...currentFoundStock,
        [ingredientName]: (currentFoundStock[ingredientName] || 0) + amount
      };

      await updateDoc(deliveryRef, {
        foundStock: newFoundStock,
        stockAdjustments: [
          ...(targetDelivery.stockAdjustments || []),
          {
            ingredientName,
            batchCode,
            adjustment: amount,
            reason: 'Found stock',
            date: new Date().toISOString(),
            type: 'found'
          }
        ]
      });

      // Update local state
      const updatedDeliveries = deliveriesData.map(del => 
        del.id === targetDelivery.id 
          ? { 
              ...del, 
              foundStock: newFoundStock,
              stockAdjustments: [
                ...(del.stockAdjustments || []),
                {
                  ingredientName,
                  batchCode,
                  adjustment: amount,
                  reason: 'Found stock',
                  date: new Date().toISOString(),
                  type: 'found'
                }
              ]
            }
          : del
      );
      setDeliveriesData(updatedDeliveries);
      
      // Update local inventory state directly
      setInventory(prevInventory => 
        prevInventory.map(item => {
          if (item.name === ingredientName) {
            return {
              ...item,
              totalQuantity: item.totalQuantity + amount,
              batches: item.batches.map(batch => {
                if (batch.batchCode === batchCode) {
                  return {
                    ...batch,
                    quantity: batch.quantity + amount,
                    foundStock: (batch.foundStock || 0) + amount
                  };
                }
                return batch;
              })
            };
          }
          return item;
        })
      );
      
    } catch (error) {
      console.error('Error adding found stock:', error);
      alert('Failed to add found stock. Please try again.');
    }
  };

  const wasteOrSendSingleUnit = async (ingredientName, batchCode) => {
    try {
      // Find the delivery that contains this batch
      const targetDelivery = deliveriesData.find(delivery => 
        delivery.batchCodes && delivery.batchCodes[ingredientName] === batchCode
      );

      if (!targetDelivery) {
        alert('Delivery not found for this batch');
        return;
      }

      const currentFoundStock = targetDelivery.foundStock?.[ingredientName] || 0;
      const deliveryRef = doc(db, 'deliveries', targetDelivery.id);

      if (currentFoundStock >= 1) {
        // Remove from found stock instead of creating allocation
        const newFoundStock = {
          ...targetDelivery.foundStock,
          [ingredientName]: currentFoundStock - 1
        };

        await updateDoc(deliveryRef, {
          foundStock: newFoundStock,
          stockAdjustments: [
            ...(targetDelivery.stockAdjustments || []),
            {
              ingredientName,
              batchCode,
              adjustment: -1,
              reason: 'Wasted/sent from found stock',
              date: new Date().toISOString(),
              type: 'waste-found'
            }
          ]
        });

        // Update local deliveries state
        const updatedDeliveries = deliveriesData.map(del => 
          del.id === targetDelivery.id 
            ? { 
                ...del, 
                foundStock: newFoundStock,
                stockAdjustments: [
                  ...(del.stockAdjustments || []),
                  {
                    ingredientName,
                    batchCode,
                    adjustment: -1,
                    reason: 'Wasted/sent from found stock',
                    date: new Date().toISOString(),
                    type: 'waste-found'
                  }
                ]
              }
            : del
        );
        setDeliveriesData(updatedDeliveries);

        // Update local inventory - reduce found stock and total quantity
        setInventory(prevInventory => 
          prevInventory.map(item => {
            if (item.name === ingredientName) {
              return {
                ...item,
                totalQuantity: Math.max(0, item.totalQuantity - 1),
                batches: item.batches.map(batch => {
                  if (batch.batchCode === batchCode) {
                    return {
                      ...batch,
                      quantity: Math.max(0, batch.quantity - 1),
                      foundStock: Math.max(0, (batch.foundStock || 0) - 1)
                    };
                  }
                  return batch;
                }).filter(batch => batch.quantity > 0)
              };
            }
            return item;
          })
        );

      } else {
        // Create allocation like the "waste all" function
        const allocation = {
          ingredientName,
          quantityAllocated: 1,
          batchCode,
          allocatedToBatchId: 'waste-restaurant',
          allocatedToBatchCode: 'Waste/Restaurant Transfer',
          allocationDate: new Date().toISOString(),
          reason: 'Wasted or sent to restaurant (single unit)'
        };

        const updatedAllocations = [...(targetDelivery.allocations || []), allocation];

        await updateDoc(deliveryRef, {
          allocations: updatedAllocations,
          stockAdjustments: [
            ...(targetDelivery.stockAdjustments || []),
            {
              ingredientName,
              batchCode,
              adjustment: -1,
              reason: 'Wasted or sent to restaurant (single unit)',
              date: new Date().toISOString(),
              type: 'waste-restaurant-single'
            }
          ]
        });

        // Update local deliveries state
        const updatedDeliveries = deliveriesData.map(del => 
          del.id === targetDelivery.id 
            ? { 
                ...del, 
                allocations: updatedAllocations,
                stockAdjustments: [
                  ...(del.stockAdjustments || []),
                  {
                    ingredientName,
                    batchCode,
                    adjustment: -1,
                    reason: 'Wasted or sent to restaurant (single unit)',
                    date: new Date().toISOString(),
                    type: 'waste-restaurant-single'
                  }
                ]
              }
            : del
        );
        setDeliveriesData(updatedDeliveries);

        // Update local inventory - reduce total quantity
        setInventory(prevInventory => 
          prevInventory.map(item => {
            if (item.name === ingredientName) {
              return {
                ...item,
                totalQuantity: Math.max(0, item.totalQuantity - 1),
                batches: item.batches.map(batch => {
                  if (batch.batchCode === batchCode) {
                    return {
                      ...batch,
                      quantity: Math.max(0, batch.quantity - 1)
                    };
                  }
                  return batch;
                }).filter(batch => batch.quantity > 0)
              };
            }
            return item;
          })
        );
      }
      
    } catch (error) {
      console.error('Error processing single unit waste/restaurant transfer:', error);
      alert('Failed to process single unit waste/restaurant transfer. Please try again.');
    }
  };

  const wasteOrSendStock = async (ingredientName, batchCode, remainingQuantity) => {
    try {
      if (remainingQuantity <= 0) return;
      
      // Find the delivery that contains this batch
      const targetDelivery = deliveriesData.find(delivery => 
        delivery.batchCodes && delivery.batchCodes[ingredientName] === batchCode
      );

      if (!targetDelivery) {
        alert('Delivery not found for this batch');
        return;
      }

      // Create allocation for waste/restaurant transfer
      const allocation = {
        ingredientName,
        quantityAllocated: remainingQuantity,
        batchCode,
        allocatedToBatchId: 'waste-restaurant',
        allocatedToBatchCode: 'Waste/Restaurant Transfer',
        allocationDate: new Date().toISOString(),
        reason: 'Wasted or sent to restaurant'
      };

      const deliveryRef = doc(db, 'deliveries', targetDelivery.id);
      const updatedAllocations = [...(targetDelivery.allocations || []), allocation];

      await updateDoc(deliveryRef, {
        allocations: updatedAllocations,
        stockAdjustments: [
          ...(targetDelivery.stockAdjustments || []),
          {
            ingredientName,
            batchCode,
            adjustment: -remainingQuantity,
            reason: 'Wasted or sent to restaurant',
            date: new Date().toISOString(),
            type: 'waste-restaurant'
          }
        ]
      });

      // Update local state
      const updatedDeliveries = deliveriesData.map(del => 
        del.id === targetDelivery.id 
          ? { 
              ...del, 
              allocations: updatedAllocations,
              stockAdjustments: [
                ...(del.stockAdjustments || []),
                {
                  ingredientName,
                  batchCode,
                  adjustment: -remainingQuantity,
                  reason: 'Wasted or sent to restaurant',
                  date: new Date().toISOString(),
                  type: 'waste-restaurant'
                }
              ]
            }
          : del
      );
      setDeliveriesData(updatedDeliveries);
      
      // Update local inventory state directly
      setInventory(prevInventory => 
        prevInventory.map(item => {
          if (item.name === ingredientName) {
            return {
              ...item,
              totalQuantity: Math.max(0, item.totalQuantity - remainingQuantity),
              batches: item.batches.map(batch => {
                if (batch.batchCode === batchCode) {
                  const newQuantity = Math.max(0, batch.quantity - remainingQuantity);
                  return {
                    ...batch,
                    quantity: newQuantity
                  };
                }
                return batch;
              }).filter(batch => batch.quantity > 0) // Remove batches with 0 quantity
            };
          }
          return item;
        })
      );
      
    } catch (error) {
      console.error('Error processing waste/restaurant transfer:', error);
      alert('Failed to process waste/restaurant transfer. Please try again.');
    }
  };

  const refreshInventoryData = async () => {
    try {
      // Re-fetch and recalculate inventory
      setLoading(true);
      
      // Fetch fresh deliveries data
      const deliveriesSnapshot = await getDocs(collection(db, 'deliveries'));
      const deliveriesData = deliveriesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      // [Rest of the inventory calculation logic from the original useEffect]
      // Extract allocations from deliveries
      const allocationsData = [];
      deliveriesData.forEach(delivery => {
        if (delivery.allocations && Array.isArray(delivery.allocations)) {
          delivery.allocations.forEach(allocation => {
            allocationsData.push({
              ingredientName: allocation.ingredientName,
              quantityUsed: allocation.quantityAllocated || 0,
              ingredientBatchCode: delivery.batchCodes?.[allocation.ingredientName] || 'N/A',
              allocatedToBatchId: allocation.allocatedToBatchId,
              allocatedToBatchCode: allocation.allocatedToBatchCode,
              allocationDate: allocation.allocationDate
            });
          });
        }
      });

      // Calculate inventory levels - start with all ingredients
      const inventoryMap = {};
      
      // Initialize all ingredients with zero stock
      ingredients.forEach(ingredient => {
        inventoryMap[ingredient.name] = {
          name: ingredient.name,
          totalQuantity: 0,
          batches: [],
          packaging: ingredient.packaging || 'units'
        };
      });
      
      // Now populate stock levels from deliveries
      deliveriesData.forEach(delivery => {
        if (delivery.selectedGoods && Array.isArray(delivery.selectedGoods)) {
          delivery.selectedGoods.forEach(goodName => {
            // Create entry for ingredients not in ingredients collection but in deliveries
            if (!inventoryMap[goodName]) {
              inventoryMap[goodName] = {
                name: goodName,
                totalQuantity: 0,
                batches: [],
                packaging: ingredients.find(ing => ing.name === goodName)?.packaging || 'units'
              };
            }
            
              const quantity = delivery.quantities && delivery.quantities[goodName] 
                ? parseInt(delivery.quantities[goodName]) || 0 
                : 0;
              
              // Add found stock to the quantity
              const foundStock = delivery.foundStock && delivery.foundStock[goodName]
                ? parseFloat(delivery.foundStock[goodName]) || 0
                : 0;
              
              const totalQuantity = quantity + foundStock;
              
              inventoryMap[goodName].totalQuantity += totalQuantity;
              
              if (totalQuantity > 0) {
                inventoryMap[goodName].batches.push({
                  batchCode: delivery.batchCodes?.[goodName] || 'N/A',
                  quantity: totalQuantity,
                  originalQuantity: quantity,
                  foundStock: foundStock,
                  useByDate: delivery.useByDates?.[goodName] || null,
                  temperature: delivery.temperatures?.[goodName] || 'N/A',
                  deliveryDate: delivery.deliveryDate,
                  supplier: delivery.supplier || 'Unknown',
                  deliveryId: delivery.id
                });
              }
          });
        }
      });

      // Subtract allocations from inventory totals
      allocationsData.forEach(allocation => {
        const ingredientName = allocation.ingredientName;
        const quantityUsed = allocation.quantityUsed || 0;
        const batchCodeUsed = allocation.ingredientBatchCode;
        
        if (inventoryMap[ingredientName] && quantityUsed > 0) {
          // First try to subtract from the specific batch that was used
          const targetBatch = inventoryMap[ingredientName].batches.find(
            batch => batch.batchCode === batchCodeUsed
          );
          
          if (targetBatch && targetBatch.quantity >= quantityUsed) {
            targetBatch.quantity -= quantityUsed;
            inventoryMap[ingredientName].totalQuantity -= quantityUsed;
          } else {
            // If specific batch not found or insufficient, subtract from total
            inventoryMap[ingredientName].totalQuantity = Math.max(0, 
              inventoryMap[ingredientName].totalQuantity - quantityUsed
            );
            
            // Distribute the subtraction across available batches
            let remainingToSubtract = quantityUsed;
            for (const batch of inventoryMap[ingredientName].batches) {
              if (remainingToSubtract <= 0) break;
              const subtractFromThisBatch = Math.min(batch.quantity, remainingToSubtract);
              batch.quantity -= subtractFromThisBatch;
              remainingToSubtract -= subtractFromThisBatch;
            }
          }
        }
      });

      // Remove batches with zero quantity and filter out completely consumed ingredients
      Object.keys(inventoryMap).forEach(ingredientName => {
        inventoryMap[ingredientName].batches = inventoryMap[ingredientName].batches.filter(
          batch => batch.quantity > 0
        );
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
      setDeliveriesData(deliveriesData);
      
    } catch (error) {
      console.error("Error refreshing inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

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
        <h3>Current Stock</h3>
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
                  <span className="quantity">{Number(item.totalQuantity) % 1 === 0 ? item.totalQuantity : Number(item.totalQuantity).toFixed(2).replace(/\.?0+$/, '')}</span>
                  <span className="unit">{item.packaging}</span>
                </div>
                <QuantityVisual quantity={item.totalQuantity} packaging={item.packaging} ingredientName={item.name} />
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
                          key={`${batch.batchCode}-${batch.deliveryId || index}`}
                          className={`batch-info${selectedBatch && selectedBatch.ingredientName === item.name && selectedBatch.batchCode === batch.batchCode && selectedBatch.deliveryId === batch.deliveryId ? ' selected' : ''}`}
                          style={{ position: 'relative', cursor: 'pointer' }}
                          onClick={() => setSelectedBatch({
                            ingredientName: item.name,
                            batchCode: batch.batchCode,
                            deliveryId: batch.deliveryId
                          })}
                        >
                         
                        <div 
                          className={`batch-item ${isExpiredBatch ? 'expired' : isExpiringBatch ? 'expiring' : ''}`}
                        >
                          <div className="batch-code">Batch: {batch.batchCode}</div>
                          <div className="batch-quantity">
                            {Number(batch.quantity) % 1 === 0 ? batch.quantity : Number(batch.quantity).toFixed(2).replace(/\.?0+$/, '')} {item.packaging}
                            {batch.foundStock > 0 && (
                              <div style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                                (Original: {Number(batch.originalQuantity) % 1 === 0 ? batch.originalQuantity : Number(batch.originalQuantity).toFixed(2).replace(/\.?0+$/, '')} + Found: {Number(batch.foundStock) % 1 === 0 ? batch.foundStock : Number(batch.foundStock).toFixed(2).replace(/\.?0+$/, '')})
                              </div>
                            )}
                          </div>
                          <div className="batch-details">
                            <div className="use-by">
                              Use by: {formatDate(batch.useByDate)}
                              {isExpiredBatch && <div className="status-tag expired">EXPIRED</div>}
                              {isExpiringBatch && !isExpiredBatch && <div className="status-tag expiring">EXPIRING</div>}
                            </div>
                            <div className="supplier">Supplier: {batch.supplier}</div>
                          </div>
                        </div>
                        
                        <QuantityVisual quantity={batch.quantity} packaging={item.packaging} ingredientName={item.name} size="small" />
                        
                        {selectedBatch && 
                         selectedBatch.ingredientName === item.name && 
                         selectedBatch.batchCode === batch.batchCode &&
                         selectedBatch.deliveryId === batch.deliveryId && (
                          <div className="stock-adjustment-controls" >
                            <div className='deliveredBatchInfo'>
                              <strong>Delivered:</strong> {formatDate(batch.deliveryDate)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addFoundStock(item.name, batch.batchCode);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                + Add Found ({getFoundIncrementAmount(item.name)} {item.packaging})
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  wasteOrSendSingleUnit(item.name, batch.batchCode);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#FF9800',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                − Waste (1 {item.packaging})
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  wasteOrSendStock(item.name, batch.batchCode, batch.quantity);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                − Waste Remaining ({batch.quantity} {item.packaging})
                              </button>
                            </div>
                          </div>
                        )}
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