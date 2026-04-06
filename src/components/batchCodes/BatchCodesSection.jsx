import React, { useRef, useEffect } from 'react';
import { isIngredientAllocationSufficient } from '../../utils/allocationUtils';

function BatchCodesSection({
  viewingBatch,
  editingField,
  setEditingField,
  editingValue,
  setEditingValue,
  handleInlineSave,
  batches,
  formatDateDisplay,
  sortIngredients,
  ingredients,
  calculateIngredientQuantities,
  formatQuantity,
  shouldUseDeliveryDropdown,
  deliveries,
  selectedBatchInput,
  setSelectedBatchInput,
  batchQuantityInput,
  setBatchQuantityInput,
  batchCodeSuggestions,
  removeStockAllocation,
  userRole
}) {
  // Refs for click outside detection
  const batchEditingRef = useRef(null);
  const quantityInputRef = useRef(null);

  // Click outside handler for batch editing mode
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (batchEditingRef.current && !batchEditingRef.current.contains(event.target)) {
        // Only exit if we're currently editing an ingredient (not starter)
        if (editingField && editingField.startsWith('ingredient-')) {
          setEditingField(null);
          setSelectedBatchInput(null);
          setBatchQuantityInput('');
        }
      }
    };

    const handleClickOutsideQuantityInput = (event) => {
      if (quantityInputRef.current && !quantityInputRef.current.contains(event.target)) {
        // Exit quantity input mode
        setSelectedBatchInput(null);
        setBatchQuantityInput('');
      }
    };

    if (editingField && editingField.startsWith('ingredient-')) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    if (selectedBatchInput) {
      document.addEventListener('mousedown', handleClickOutsideQuantityInput);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutsideQuantityInput);
    };
  }, [editingField, selectedBatchInput, setEditingField, setSelectedBatchInput, setBatchQuantityInput]);

  // Helper function to get week's date range (Saturday to Friday) for a given date
  const getWeekRange = (referenceDate) => {
    const date = new Date(referenceDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate days to subtract to get to Saturday
    // Saturday = 6, so we want: Saturday = 0 days back, Sunday = 1 day back, Monday = 2 days back, etc.
    const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysToSaturday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Friday is 6 days after Saturday
    weekEnd.setHours(23, 59, 59, 999);
    
    return { weekStart, weekEnd };
  };

  // Auto-fill function for admin users
  const autoFillAllBatchCodes = async () => {
    if (userRole !== 'admin' || !shouldUseDeliveryDropdown(viewingBatch.batch_code)) {
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm('Make sure all deliveries have been logged before autofill! Continue?');
    if (!confirmed) {
      return;
    }

    const ingredientQuantities = calculateIngredientQuantities(viewingBatch.pizzas);
    const availableIngredients = ingredients.filter(ingredient =>
      viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name))
    );

    // Process each ingredient
    for (const ingredient of availableIngredients) {
      // Check if this ingredient already has batch codes assigned
      const existingBatchCode = viewingBatch.pizzas
        .flatMap(pizza => pizza.ingredients.includes(ingredient.name) ? pizza.ingredientBatchCodes[ingredient.name] : [])
        .find(code => code && code.trim());

      if (existingBatchCode) {
        continue; // Skip ingredients that already have batch codes assigned
      }

      const ingredientQuantity = ingredientQuantities[ingredient.name] || { quantity: 0, unitWeight: 1, unit: '' };
      const numberOfUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;

      // Find available deliveries for this ingredient
      const availableDeliveries = deliveries
        .filter(delivery =>
          delivery.batchCodes &&
          delivery.batchCodes[ingredient.name]
        )
        .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate)) // Sort by delivery date (oldest first)
        .map(delivery => {
          const batchCode = delivery.batchCodes[ingredient.name];
          const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name]
            ? parseFloat(delivery.quantities[ingredient.name]) || 0
            : 0;
          const allocatedQty = (delivery.allocations || [])
            .filter(alloc =>
              alloc.ingredientName === ingredient.name &&
              delivery.batchCodes &&
              delivery.batchCodes[ingredient.name] === batchCode
            )
            .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
          const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name]
            ? parseFloat(delivery.foundStock[ingredient.name]) || 0
            : 0;
          const availableStock = deliveredQty - allocatedQty + foundStock;
          return {
            batchCode,
            availableStock,
            deliveryDate: new Date(delivery.deliveryDate).toISOString()
          };
        }); // Show all batches, even with availableStock <= 0

      // No longer skip ingredients with no available stock

      // Auto-allocate quantities using the same logic as the manual selection
      let remainingQuantity = numberOfUnits;
      const batchAllocations = [];

      for (const delivery of availableDeliveries) {
        if (remainingQuantity <= 0) break;
        const allocationQuantity = Math.min(remainingQuantity, delivery.availableStock);
        if (allocationQuantity > 0) {
          batchAllocations.push({
            code: delivery.batchCode,
            deliveryDate: delivery.deliveryDate,
            quantity: allocationQuantity
          });
          remainingQuantity -= allocationQuantity;
        }
      }

      // Format the batch codes string as batchcode:deliverydate:qty
      if (batchAllocations.length > 0) {
        const newValue = batchAllocations.map(b => `${b.code}:${b.deliveryDate}:${b.quantity.toFixed(2)}`).join(', ');
        // Save the batch codes for this ingredient
        await handleInlineSave("ingredient", ingredient.name, null, newValue);
      }
    }
  };

  const normalizeDateKey = (dateStr) => {
    if (!dateStr) return '';
    const parsed = new Date(dateStr);
    if (isNaN(parsed)) return String(dateStr).split('T')[0] || String(dateStr);
    return parsed.toISOString().split('T')[0];
  };

  const parseBatchAllocations = (batchString) => {
    if (!batchString || !String(batchString).trim()) return [];

    return String(batchString)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const firstColon = item.indexOf(':');
        const lastColon = item.lastIndexOf(':');

        if (firstColon === -1 || lastColon === -1 || firstColon === lastColon) {
          const parts = item.split(':');
          return {
            code: parts[0]?.trim() || '',
            deliveryDate: parts[1] || '',
            quantity: parts[2] ? parseFloat(parts[2]) : 0
          };
        }

        return {
          code: item.slice(0, firstColon).trim(),
          deliveryDate: item.slice(firstColon + 1, lastColon),
          quantity: parseFloat(item.slice(lastColon + 1))
        };
      })
      .map(allocation => ({
        ...allocation,
        quantity: isNaN(allocation.quantity) ? 0 : allocation.quantity
      }));
  };

  const formatBatchAllocations = (allocations) => {
    const validAllocations = allocations
      .filter(a => a && a.code && a.deliveryDate && a.quantity > 0)
      .map(a => ({ ...a, quantity: Math.max(0, a.quantity) }));

    if (!validAllocations.length) return '';
    return validAllocations
      .map(a => `${a.code}:${a.deliveryDate}:${a.quantity.toFixed(2)}`)
      .join(', ');
  };

  const rebalanceIngredientAllocationsForCompletion = React.useCallback(async () => {
    const ingredientQuantities = calculateIngredientQuantities(viewingBatch.pizzas);

    const activeIngredients = ingredients.filter(ingredient =>
      viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name))
    );

    for (const ingredient of activeIngredients) {
      const ingredientName = ingredient.name;
      const currentBatchCode = viewingBatch.pizzas
        .flatMap(pizza => pizza.ingredients.includes(ingredientName) ? pizza.ingredientBatchCodes[ingredientName] : [])
        .find(code => code && code.trim());

      if (!currentBatchCode) continue;

      const allocations = parseBatchAllocations(currentBatchCode);
      if (!allocations.length) continue;

      const ingredientQuantity = ingredientQuantities[ingredientName] || { quantity: 0, unitWeight: 1 };
      const requiredUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;
      const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
      const tolerance = 0.01;
      const diff = requiredUnits - totalAllocated;

      if (Math.abs(diff) <= tolerance) continue;

      const updatedAllocations = allocations.map(a => ({ ...a }));

      if (diff > tolerance) {
        // Increase from the earliest selected delivery first, up to available stock.
        const increaseOrder = [...updatedAllocations]
          .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));

        let remainingToAdd = diff;

        for (const allocation of increaseOrder) {
          if (remainingToAdd <= tolerance) break;

          const matchingDelivery = deliveries.find(delivery => {
            if (!delivery.batchCodes || delivery.batchCodes[ingredientName] !== allocation.code) return false;
            return normalizeDateKey(delivery.deliveryDate) === normalizeDateKey(allocation.deliveryDate);
          });

          if (!matchingDelivery) continue;

          const deliveredQty = matchingDelivery.quantities && matchingDelivery.quantities[ingredientName]
            ? parseFloat(matchingDelivery.quantities[ingredientName]) || 0
            : 0;
          const allocatedQty = (matchingDelivery.allocations || [])
            .filter(alloc =>
              alloc.ingredientName === ingredientName &&
              matchingDelivery.batchCodes &&
              matchingDelivery.batchCodes[ingredientName] === allocation.code
            )
            .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
          const foundStock = matchingDelivery.foundStock && matchingDelivery.foundStock[ingredientName]
            ? parseFloat(matchingDelivery.foundStock[ingredientName]) || 0
            : 0;
          const availableStock = Math.max(0, deliveredQty - allocatedQty + foundStock);

          if (availableStock <= 0) continue;

          const amountToAdd = Math.min(remainingToAdd, availableStock);
          allocation.quantity += amountToAdd;
          remainingToAdd -= amountToAdd;
        }
      } else {
        // Decrease from the latest selected delivery first.
        const decreaseOrder = [...updatedAllocations]
          .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));

        let remainingToRemove = Math.abs(diff);

        for (const allocation of decreaseOrder) {
          if (remainingToRemove <= tolerance) break;
          const amountToRemove = Math.min(allocation.quantity, remainingToRemove);
          allocation.quantity -= amountToRemove;
          remainingToRemove -= amountToRemove;
        }
      }

      const normalizedAllocations = updatedAllocations.map(allocation => ({
        ...allocation,
        quantity: allocation.quantity <= tolerance ? 0 : allocation.quantity
      }));

      const newValue = formatBatchAllocations(normalizedAllocations);

      if (newValue !== currentBatchCode) {
        await handleInlineSave('ingredient', ingredientName, null, newValue);
      }
    }
  }, [ingredients, viewingBatch, deliveries, calculateIngredientQuantities, handleInlineSave]);


  // Update quantities logic: checks if qty allocated matches required, sets state for display
  const [ingredientQtyMatch, setIngredientQtyMatch] = React.useState({});

  const updateQuantitiesToMatchRequired = React.useCallback(() => {
    const ingredientQuantities = calculateIngredientQuantities(viewingBatch.pizzas);
    const updatedMatch = {};
    ingredients.forEach(ingredient => {
      if (!viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name))) return;
      const batchCode = viewingBatch.pizzas
        .flatMap(pizza => pizza.ingredients.includes(ingredient.name) ? pizza.ingredientBatchCodes[ingredient.name] : [])
        .find(code => code);
      const ingredientQuantity = ingredientQuantities[ingredient.name] || { quantity: 0, unitWeight: 1, unit: '' };
      const numberOfUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;
      if (!batchCode) {
        updatedMatch[ingredient.name] = false;
      } else {
        // Use the same logic as the display: sum parts[4] for each batch code entry
        const totalAllocated = batchCode.split(',').reduce((acc, item) => {
          const parts = item.trim().split(':');
          const qty = parts.length > 4 ? parseFloat(parts[4]) : 0;
          return acc + (isNaN(qty) ? 0 : qty);
        }, 0);
        // Compare with tolerance of 0.01
        updatedMatch[ingredient.name] = Math.abs(totalAllocated - numberOfUnits) <= 0.01;
      }
    });
    setIngredientQtyMatch(updatedMatch);
  }, [ingredients, viewingBatch, calculateIngredientQuantities]);

  // Run the match logic automatically when relevant data changes
  React.useEffect(() => {
    if (viewingBatch && viewingBatch.pizzas && ingredients.length > 0) {
      updateQuantitiesToMatchRequired();
    }
  }, [viewingBatch, ingredients, updateQuantitiesToMatchRequired]);

  return (
    <div>
      <div>
        <p className='pizzaNumbers'>
        <strong>              
          {viewingBatch.batch_type === 'dough balls' ? 'Dough Ball Numbers Complete:' : 'Pizza Numbers Complete:'}</strong>{" "}
        <input
          type="checkbox"
          checked={viewingBatch.pizza_numbers_complete || false}
          onChange={async (e) => {
            const newValue = e.target.checked;
            try {
              if (newValue) {
                await rebalanceIngredientAllocationsForCompletion();
              }
              await handleInlineSave("batch", null, "pizza_numbers_complete", newValue);
            } catch (error) {
              console.error("Error updating checkbox:", error);
            }
          }}
        />
      </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4>Batch Codes:</h4>
        {userRole === 'admin' && shouldUseDeliveryDropdown(viewingBatch.batch_code) && (
          <>
          <button
            type="button"
            className="button autoFillButton"
            onClick={autoFillAllBatchCodes}
            title="Automatically fill all ingredient batch codes with available stock"
          >
            Auto-Fill All
          </button>
          {/* Update Quantities button removed; now handled automatically by useEffect */}
          </>
        )}
      </div>
      <div className='ingredientBatchcodeBox'>
        <div className='ingredient container' style={{
          color: viewingBatch.starter_batch_code ? 'inherit' : 'red',
          marginBottom: !viewingBatch.starter_batch_code ? '14px' : undefined
        }}>
          <div className='starter'><strong>Starter: </strong></div>
          {editingField === 'starter-batch' ? (
            <div className="batchButtonContainer" style={{ marginTop: '10px' }}>
              {/* Starter batch buttons - filtered by viewing batch's week */}
              {(() => {
                const { weekStart, weekEnd } = getWeekRange(viewingBatch.batch_date);
                return batches
                  .filter(batch => {
                    if (batch.batch_type !== 'starter') return false;
                    const batchDate = new Date(batch.batch_date);
                    return batchDate >= weekStart && batchDate <= weekEnd;
                  })
                  .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
                  .map(batch => {
                    const isSelected = viewingBatch.starter_batch_code === batch.batch_code;
                    return (
                      <div
                        key={batch.id}
                        className={`batchSelect ${isSelected ? 'selectedBatch' : 'notSelectedBatch'}`}
                        onClick={() => {
                          const newValue = isSelected ? "" : batch.batch_code;
                          handleInlineSave("batch", null, "starter_batch_code", newValue);
                          setEditingField(null);
                        }}
                        style={{ cursor: 'pointer', marginBottom: '5px' }}
                      >
                        <div className="batchLabel">
                          <div>Batch Code: {batch.batch_code}</div>
                          <div>Date: {formatDateDisplay(batch.batch_date)}</div>
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          ) : (
            <div className='starter' onClick={() => {
              setEditingField('starter-batch');
              setEditingValue(viewingBatch.starter_batch_code || "");
            }}>
              {viewingBatch.starter_batch_code ? (() => {
                return <div className='selectedBatch'># {viewingBatch.starter_batch_code}</div>;
              })() : <span style={{ color: 'red' }}>+</span>}
            </div>
          )}
        </div>

        

        {sortIngredients(
          ingredients
            .filter(ingredient =>
            // filter out patting out flour for now
              ingredient.name !== 'Patting-Out Flour' &&


              viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name))
            )
        ).map(ingredient => {
          const batchCode = viewingBatch.pizzas
            .flatMap(pizza => pizza.ingredients.includes(ingredient.name) ? pizza.ingredientBatchCodes[ingredient.name] : [])
            .find(code => code);
          const ingredientQuantity = calculateIngredientQuantities(viewingBatch.pizzas)[ingredient.name] || { quantity: 0, unitWeight: 1, unit: '' };
          const numberOfUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;

          // Check if quantities are sufficient
          const isQuantitySufficient = ingredient.name === 'starter'
            ? true
            : (batchCode ? isIngredientAllocationSufficient(batchCode, numberOfUnits) : false);

          const qtyMatch = ingredientQtyMatch[ingredient.name];
          return (
            <div key={ingredient.id} className='ingredient container' style={{ color: (batchCode && isQuantitySufficient) ? 'inherit' : 'red' }}>
              <p>
                <strong>{ingredient.name == "Flour (Caputo Red)"? 'Mix Flour (Red)': ingredient.name == "Patting-Out Flour" ? 'Patting-Out Flour (Blue)' : ingredient.name}:</strong>
                {ingredient.name !== "Flour (Caputo Blue)" && ingredient.name !== "Wholemeal Flour" && ingredient.name !== "Salt" && ingredient.name !== "Rye Flour" &&
                  ` ${formatQuantity(numberOfUnits)} ${ingredientQuantity.unit}`
                }
              </p>
              {/* Check for insufficient allocation quantities */}
              {(() => {
                if (!batchCode || ingredient.name === 'starter') return null;
                const isInsufficient = !isIngredientAllocationSufficient(batchCode, numberOfUnits);
                return isInsufficient ? (
                  <p style={{ color: 'red', fontSize: '0.9em', margin: '0 0 5px 0' }}>
                    *insufficient allocation quantities
                  </p>
                ) : null;
              })()}
              {/* Display yes/no message if updateQuantitiesToMatchRequired has been called */}
              {batchCode && ingredientQtyMatch.hasOwnProperty(ingredient.name) && (() => {
                // Calculate allocated and required quantities for display
                let allocated = 0;
                allocated = batchCode.split(',').reduce((acc, item) => {
                  const parts = item.trim().split(':');
                  const qty = parts.length > 4 ? parseFloat(parts[4]) : 0;
                  return acc + (isNaN(qty) ? 0 : qty);
                }, 0);
                const required = numberOfUnits;
                const allocatedDisplay = allocated > 0 ? allocated.toFixed(2) : 'N/A';
                const requiredDisplay = required.toFixed(2);
                return (
                  <div style={{ fontSize: '0.95em', margin: '2px 0 2px 0', color: qtyMatch ? 'green' : 'red' }}>
                    { qtyMatch
                      ? ``
                      : `Qty allocated (${allocatedDisplay}) does not match required (${requiredDisplay})`}
                  </div>
                );
              })()}
              {editingField === `ingredient-${ingredient.name}` ? (
                <div ref={batchEditingRef}>
                  {shouldUseDeliveryDropdown(viewingBatch.batch_code) ? (
                    <div className="batchButtonContainer" style={{ marginTop: '10px' }}>
                      {(() => {
                        // Filter deliveries: exclude those with unavailable stock unless they contain an allocation for the viewing batch
                        const sortedDeliveries = deliveries
                          .filter(delivery => {
                            if (!(delivery.batchCodes && delivery.batchCodes[ingredient.name])) return false;
                            // Calculate available stock
                            const batchCode = delivery.batchCodes[ingredient.name];
                            const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name]
                              ? parseFloat(delivery.quantities[ingredient.name]) || 0
                              : 0;
                            const allocatedQty = (delivery.allocations || [])
                              .filter(alloc =>
                                alloc.ingredientName === ingredient.name &&
                                delivery.batchCodes &&
                                delivery.batchCodes[ingredient.name] === batchCode
                              )
                              .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                            const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name]
                              ? parseFloat(delivery.foundStock[ingredient.name]) || 0
                              : 0;
                            const availableStock = deliveredQty - allocatedQty + foundStock;
                            // Check if this delivery has an allocation for the viewing batch
                            const hasViewingBatchAllocation = (delivery.allocations || []).some(alloc =>
                              alloc.ingredientName === ingredient.name &&
                              alloc.allocatedToBatchCode === viewingBatch.batch_code
                            );
                            // Filter logic: keep if availableStock > 0, or if it has allocation for viewing batch
                            return availableStock > 0 || hasViewingBatchAllocation;
                          })
                          .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
                        const earliestDelivery = sortedDeliveries[sortedDeliveries.length - 1];
                        return sortedDeliveries.map((delivery, idx) => {
                          const isEarliest = delivery === earliestDelivery;
                          // ...existing code...
                          const batchCode = delivery.batchCodes[ingredient.name];
                          // Parse batch codes, delivery dates, and quantities
                          const parseBatchData = (batchString) => {
                            if (!batchString) return [];
                            return batchString.split(',').map(item => {
                              const trimmed = item.trim();
                              const firstColon = trimmed.indexOf(':');
                              const lastColon = trimmed.lastIndexOf(':');
                              if (firstColon === -1 || lastColon === -1 || firstColon === lastColon) {
                                // fallback for legacy or malformed
                                const parts = trimmed.split(':');
                                return {
                                  code: parts[0]?.trim() || '',
                                  deliveryDate: parts[1] || '',
                                  quantity: parts[2] ? parseFloat(parts[2]) : (parts[1] && !isNaN(parts[1])) ? parseFloat(parts[1]) : 0
                                };
                              }
                              return {
                                code: trimmed.slice(0, firstColon).trim(),
                                deliveryDate: trimmed.slice(firstColon + 1, lastColon),
                                quantity: parseFloat(trimmed.slice(lastColon + 1))
                              };
                            });
                          };

                          // Use the most current batch code value (either from editingValue or the actual batchCode)
                          const currentBatchString = editingValue || batchCode || '';
                          const currentBatchData = parseBatchData(currentBatchString);
                          // Normalize delivery date to YYYY-MM-DD for comparison
                          const normalizeDate = (dateStr) => {
                            if (!dateStr) return '';
                            // Accepts ISO or date-only strings
                            const d = new Date(dateStr);
                            if (isNaN(d)) return dateStr.split('T')[0] || dateStr; // fallback
                            return d.toISOString().split('T')[0];
                          };
                          const deliveryDateNorm = normalizeDate(delivery.deliveryDate);
                          const currentBatch = currentBatchData.find(b => b.code === batchCode && normalizeDate(b.deliveryDate) === deliveryDateNorm);
                          
                          // Check if this specific delivery has allocations for this ingredient and batch code
                          const hasAllocationInDB = (delivery.allocations || []).some(alloc => 
                            alloc.ingredientName === ingredient.name &&
                            alloc.batchCode === batchCode &&
                            alloc.deliveryId === delivery.id &&
                            alloc.quantityAllocated > 0
                          );
                          
                          // Also check current editing state - if we're editing and this batch has quantity > 0
                          const hasAllocationInEdit = currentBatch && currentBatch.quantity > 0;
                          
                          // Selected if it has allocation in DB, unless we're currently editing and it has 0 quantity
                          const isSelected = editingField === `ingredient-${ingredient.name}` 
                            ? hasAllocationInEdit 
                            : hasAllocationInDB;
                            

                          const batchInputKey = `${delivery.id}-${ingredient.name}`;
                          const showInput = selectedBatchInput === batchInputKey;
                          const isSelectedOrShowingInput = isSelected || showInput;

                          return (
                            <div
                              key={`${delivery.id}-${ingredient.name}`}
                              className={`batchSelect ${isSelectedOrShowingInput ? 'selectedBatch' : 'notSelectedBatch'}${isEarliest ? ' pulse-batch' : ''}`}
                              onClick={(e) => {
                                
                                
                                if (isSelected) {
                                  // Remove this batch from the list (only if it has quantity > 0)
                                  let updatedBatchData = currentBatchData.filter(b => !(b.code === batchCode && normalizeDate(b.deliveryDate) === deliveryDateNorm));
                                  // Only keep batches with quantity > 0
                                  updatedBatchData = updatedBatchData.filter(b => b.quantity > 0);
                                  const newValue = updatedBatchData.length > 0 
                                    ? updatedBatchData.map(b => `${b.code}:${b.deliveryDate}:${b.quantity.toFixed(2)}`).join(', ')
                                    : '';
                                  setEditingValue(newValue);
                                  handleInlineSave("ingredient", ingredient.name, null, newValue);
                                } else {
                                  // Add this batch to the list only if quantity > 0
                                  // First remove any existing entry for this batch code (including zero quantity ones)
                                  let updatedBatchData = currentBatchData.filter(b => !(b.code === batchCode && normalizeDate(b.deliveryDate) === deliveryDateNorm));
                                  // Calculate available stock for this batch
                                  const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name] 
                                    ? parseFloat(delivery.quantities[ingredient.name]) || 0 
                                    : 0;
                                  const allocatedQty = (delivery.allocations || [])
                                    .filter(alloc => 
                                      alloc.ingredientName === ingredient.name && 
                                      delivery.batchCodes && 
                                      delivery.batchCodes[ingredient.name] === batchCode
                                    )
                                    .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                  const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name] 
                                    ? parseFloat(delivery.foundStock[ingredient.name]) || 0 
                                    : 0;
                                  const availableStock = deliveredQty - allocatedQty + foundStock;
                                  // Calculate sum of all other batch quantities
                                  const sumOtherBatches = updatedBatchData.reduce((sum, b) => sum + (typeof b.quantity === 'number' ? b.quantity : 0), 0);
                                  const quantityNeeded = numberOfUnits - sumOtherBatches;
                                  const quantity = Math.max(0, Math.min(quantityNeeded, availableStock));
                                  if (quantity > 0) {
                                    updatedBatchData.push({ code: batchCode, deliveryDate: new Date(delivery.deliveryDate).toISOString(), quantity });
                                  }
                                  // Only keep batches with quantity > 0
                                  const filteredBatchData = updatedBatchData.filter(b => b.quantity > 0);
                                  const newValue = filteredBatchData.length > 0
                                    ? filteredBatchData.map(b => `${b.code}:${b.deliveryDate}:${b.quantity.toFixed(2)}`).join(', ')
                                    : '';
                                  setEditingValue(newValue);
                                  setBatchQuantityInput(quantity > 0 ? quantity.toFixed(2) : '');
                                  handleInlineSave("ingredient", ingredient.name, null, newValue);
                                }
                                setEditingField(`ingredient-${ingredient.name}`); // Keep editing mode open
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="batchLabel">
                                <div>Batch Code: {batchCode} </div> 
                                <div> Qty in Stock: {(() => {
                                  // Calculate quantity in stock: delivered - allocated + found stock
                                  const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name] 
                                    ? parseFloat(delivery.quantities[ingredient.name]) || 0 
                                    : 0;
                                  
                                  const allocatedQty = (delivery.allocations || [])
                                    .filter(alloc => 
                                      alloc.ingredientName === ingredient.name && 
                                      delivery.batchCodes && 
                                      delivery.batchCodes[ingredient.name] === batchCode
                                    )
                                    .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                  
                                  const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name] 
                                    ? parseFloat(delivery.foundStock[ingredient.name]) || 0 
                                    : 0;
                                  
                                  const qtyInStock = deliveredQty - allocatedQty + foundStock;
                                  const qtyDisplay = Number(qtyInStock) % 1 === 0 ? qtyInStock : Number(qtyInStock).toFixed(2).replace(/\.?0+$/, '');
                                  return `${qtyDisplay} ${ingredient.packaging || 'units'}`;
                                })()} </div>
                                <div>Delivered: {new Date(delivery.deliveryDate).toLocaleDateString('en-GB')} </div>
                                <div className='qtyUsed' onClick={(e) => {
                                  // If clicking on the parent div but not on the input itself, close the input
                                  if (showInput && e.target.className === 'qtyUsed') {
                                    setSelectedBatchInput(null);
                                    setBatchQuantityInput('');
                                    e.stopPropagation();
                                  }
                                }}>
                                  <div className='qtyUsedLabel'>Qty Used:</div>
                                  {!showInput && (
                                    <div 

                                    >
                                      {currentBatch && typeof currentBatch.quantity === 'number' ? currentBatch.quantity.toFixed(2) : '0'}
                                    </div>
                                  )}
                                  {showInput && (
                                    <div ref={quantityInputRef}>
                                      <input
                                        type="number"
                                        value={batchQuantityInput}
                                        onChange={(e) => {
                                          const inputValue = parseFloat(e.target.value) || 0;
                                          
                                          // Calculate max available stock
                                          const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name] 
                                            ? parseInt(delivery.quantities[ingredient.name]) || 0 
                                            : 0;
                                          
                                          const allocatedQty = (delivery.allocations || [])
                                            .filter(alloc => 
                                              alloc.ingredientName === ingredient.name && 
                                              delivery.batchCodes && 
                                              delivery.batchCodes[ingredient.name] === batchCode
                                            )
                                            .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                          
                                          const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name] 
                                            ? parseFloat(delivery.foundStock[ingredient.name]) || 0 
                                            : 0;
                                          
                                          const maxAvailable = deliveredQty - allocatedQty + foundStock;
                                          
                                          // Don't allow input to exceed available stock or go below 0
                                          const validValue = inputValue < 0 ? 0 : (inputValue > maxAvailable ? maxAvailable : inputValue);
                                          setBatchQuantityInput(validValue.toString());
                                          
                                          // Real-time adjustment for visual feedback
                                          if (currentBatchData.length === 2) {
                                            const newQuantity = validValue;
                                            let updatedBatchData = [...currentBatchData];
                                            
                                            // Update the current batch's quantity
                                            const currentIndex = updatedBatchData.findIndex(b => b.code === batchCode);
                                            if (currentIndex >= 0) {
                                              updatedBatchData[currentIndex].quantity = newQuantity;
                                              
                                              // Adjust the other batch instantly
                                              const otherIndex = currentIndex === 0 ? 1 : 0;
                                              const remainingQuantity = numberOfUnits - newQuantity;
                                              updatedBatchData[otherIndex].quantity = Math.max(0, remainingQuantity);
                                              
                                              // Update the editing value for instant visual feedback
                                              const newValue = updatedBatchData.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ');
                                              setEditingValue(newValue);
                                            }
                                          }
                                        }}
                                        placeholder="Quantity"
                                        autoFocus
                                        style={{
                                          maxWidth: '50px',
                                          padding: '4px',
                                          borderRadius: '4px',
                                          border: '1px solid #ccc',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => {
                                          const inputQuantity = parseFloat(batchQuantityInput) || 0;
                                          
                                          // Calculate max available stock
                                          const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name] 
                                            ? parseInt(delivery.quantities[ingredient.name]) || 0 
                                            : 0;
                                          
                                          const allocatedQty = (delivery.allocations || [])
                                            .filter(alloc => 
                                              alloc.ingredientName === ingredient.name && 
                                              delivery.batchCodes && 
                                              delivery.batchCodes[ingredient.name] === batchCode
                                            )
                                            .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                          
                                          const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name] 
                                            ? parseFloat(delivery.foundStock[ingredient.name]) || 0 
                                            : 0;
                                          
                                          const maxAvailable = deliveredQty - allocatedQty + foundStock;
                                          const newQuantity = inputQuantity < 0 ? 0 : (inputQuantity > maxAvailable ? maxAvailable : inputQuantity);
                                          
                                          let updatedBatchData = [...currentBatchData];
                                          
                                          // Update the current batch's quantity
                                          const currentIndex = updatedBatchData.findIndex(b => b.code === batchCode);
                                          if (currentIndex >= 0) {
                                            updatedBatchData[currentIndex].quantity = newQuantity;
                                          }

                                          // If there are multiple batches, adjust the others to maintain total
                                          if (updatedBatchData.length === 2) {
                                            const otherIndex = currentIndex === 0 ? 1 : 0;
                                            const remainingQuantity = numberOfUnits - newQuantity;
                                            updatedBatchData[otherIndex].quantity = Math.max(0, remainingQuantity);
                                          }

                                          // Save the updated batch data
                                          const newValue = updatedBatchData.map(b => `${b.code}:${b.deliveryDate || ''}:${b.quantity.toFixed(2)}`).join(', ');
                                          setEditingValue(newValue);
                                          handleInlineSave("ingredient", ingredient.name, null, newValue);
                                          setSelectedBatchInput(null);
                                          setBatchQuantityInput('');
                                        }}
                                        onKeyDown={(e) => {
                                          e.stopPropagation();
                                          if (e.key === 'Enter') {
                                            const inputQuantity = parseFloat(batchQuantityInput) || 0;
                                            
                                            // Calculate max available stock
                                            const deliveredQty = delivery.quantities && delivery.quantities[ingredient.name] 
                                              ? parseInt(delivery.quantities[ingredient.name]) || 0 
                                              : 0;
                                            
                                            const allocatedQty = (delivery.allocations || [])
                                              .filter(alloc => 
                                                alloc.ingredientName === ingredient.name && 
                                                delivery.batchCodes && 
                                                delivery.batchCodes[ingredient.name] === batchCode
                                              )
                                              .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                            
                                            const foundStock = delivery.foundStock && delivery.foundStock[ingredient.name] 
                                              ? parseFloat(delivery.foundStock[ingredient.name]) || 0 
                                              : 0;
                                            
                                            const maxAvailable = deliveredQty - allocatedQty + foundStock;
                                            const newQuantity = inputQuantity < 0 ? 0 : (inputQuantity > maxAvailable ? maxAvailable : inputQuantity);
                                            
                                            let updatedBatchData = [...currentBatchData];
                                            
                                            // Update the current batch's quantity
                                            const currentIndex = updatedBatchData.findIndex(b => b.code === batchCode);
                                            if (currentIndex >= 0) {
                                              updatedBatchData[currentIndex].quantity = newQuantity;
                                            }

                                            // If there are multiple batches, adjust the others to maintain total
                                            if (updatedBatchData.length === 2) {
                                              const otherIndex = currentIndex === 0 ? 1 : 0;
                                              const remainingQuantity = numberOfUnits - newQuantity;
                                              updatedBatchData[otherIndex].quantity = Math.max(0, remainingQuantity);
                                            }

                                            // Save the updated batch data
                                            const newValue = updatedBatchData.map(b => `${b.code}:${b.deliveryDate || ''}:${b.quantity.toFixed(2)}`).join(', ');
                                            setEditingValue(newValue);
                                            handleInlineSave("ingredient", ingredient.name, null, newValue);
                                            setSelectedBatchInput(null);
                                            setBatchQuantityInput('');
                                          }
                                          if (e.key === 'Escape') {
                                            setSelectedBatchInput(null);
                                            setBatchQuantityInput('');
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        list={`batch-code-suggestions-${ingredient.name}`}
                        value={editingValue}
                        autoFocus
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => handleInlineSave("ingredient", ingredient.name, null, editingValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInlineSave("ingredient", ingredient.name, null, editingValue);
                        }}
                      />
                      <datalist id={`batch-code-suggestions-${ingredient.name}`}>
                        {(batchCodeSuggestions[ingredient.name] || [])
                          .filter(code =>
                            editingValue
                              ? code.toLowerCase().includes(editingValue.toLowerCase())
                              : true
                          )
                          .slice(0, 3) // Limit to 3 suggestions
                          .map(code => (
                            <option key={code} value={code} />
                          ))}
                      </datalist>
                    </>
                  )}
                </div>
              ) : (
                <div onClick={() => {
                  setEditingField(`ingredient-${ingredient.name}`);
                  setEditingValue(batchCode || "");
                }}>
                  {batchCode ? (
                    <div className='selectedBatch'>
                      <div>
                      Batch Code{batchCode.includes(',') ? 's' : ''}: {
                        batchCode.split(',').map(item => {
                          const [code, qty] = item.trim().split(':');
                          return qty ? `${code}` : code;
                        }).join(', ')
                      }
                      </div>
                      {/* <div>
                        Qty Allocated: {
                          (() => {
                            const sum = batchCode.split(',').reduce((acc, item) => {
                              const parts = item.trim().split(':');
                              const qty = parts.length > 4 ? parseFloat(parts[4]) : 0;
                              return acc + (isNaN(qty) ? 0 : qty);
                            }, 0);
                            return sum > 0 ? sum.toFixed(2) : 'N/A';
                          })()
                        }
                      </div> */}
                    </div>
                  ) : (
                    <span style={{ color: 'red' }}>+</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        
      </div>
    </div>
  );
}

export default BatchCodesSection;