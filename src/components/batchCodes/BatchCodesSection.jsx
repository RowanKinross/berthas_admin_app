import React, { useRef, useEffect } from 'react';

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
          
          // Calculate available stock
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
          
          const availableStock = deliveredQty - allocatedQty + foundStock;
          
          return {
            batchCode,
            availableStock,
            deliveryDate: new Date(delivery.deliveryDate)
          };
        })
        .filter(item => item.availableStock > 0); // Only include batches with available stock

      if (availableDeliveries.length === 0) {
        continue; // Skip ingredients with no available stock
      }

      // Auto-allocate quantities using the same logic as the manual selection
      let remainingQuantity = numberOfUnits;
      const batchAllocations = [];

      for (const delivery of availableDeliveries) {
        if (remainingQuantity <= 0) break;
        
        const allocationQuantity = Math.min(remainingQuantity, delivery.availableStock);
        if (allocationQuantity > 0) {
          batchAllocations.push({
            code: delivery.batchCode,
            quantity: allocationQuantity
          });
          remainingQuantity -= allocationQuantity;
        }
      }

      // Format the batch codes string
      if (batchAllocations.length > 0) {
        const newValue = batchAllocations.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ');
        
        // Save the batch codes for this ingredient
        await handleInlineSave("ingredient", ingredient.name, null, newValue);
      }
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4>Batch Codes:</h4>
        {userRole === 'admin' && shouldUseDeliveryDropdown(viewingBatch.batch_code) && (
          <button
            type="button"
            className="button autoFillButton"
            onClick={autoFillAllBatchCodes}
            title="Automatically fill all ingredient batch codes with available stock"
          >
            Auto-Fill All
          </button>
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
                const selectedStarter = batches.find(batch =>
                  batch.batch_type === 'starter' && batch.batch_code === viewingBatch.starter_batch_code
                );
                if (selectedStarter?.ingredientBatchCodes) {
                  const ingredients = [];
                  if (selectedStarter.ingredientBatchCodes['Flour (Caputo Blue)']) {
                    ingredients.push(`Flour (Caputo Blue): ${selectedStarter.ingredientBatchCodes['Flour (Caputo Blue)']}`);
                  }
                  if (selectedStarter.ingredientBatchCodes['Wholemeal Flour']) {
                    ingredients.push(`Wholemeal Flour: ${selectedStarter.ingredientBatchCodes['Wholemeal Flour']}`);
                  }
                  if (ingredients.length > 0) {
                    return <div className='selectedBatch'>{ingredients.join(', ')}</div>;
                  }
                }
                return <div className='selectedBatch'># {viewingBatch.starter_batch_code}</div>;
              })() : <span style={{ color: 'red' }}>+</span>}
            </div>
          )}
        </div>

        

        {sortIngredients(
          ingredients.filter(ingredient =>
            viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name))
          )
        ).map(ingredient => {
          const batchCode = viewingBatch.pizzas
            .flatMap(pizza => pizza.ingredients.includes(ingredient.name) ? pizza.ingredientBatchCodes[ingredient.name] : [])
            .find(code => code);
          const ingredientQuantity = calculateIngredientQuantities(viewingBatch.pizzas)[ingredient.name] || { quantity: 0, unitWeight: 1, unit: '' };
          const numberOfUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;

          // Check if quantities are sufficient
          const isQuantitySufficient = batchCode ? (() => {
            const totalAllocated = batchCode.split(',').reduce((sum, item) => {
              const [code, qty] = item.trim().split(':');
              return sum + (qty ? parseFloat(qty) : 0);
            }, 0);
            return totalAllocated >= numberOfUnits;
          })() : false;

          return (
            <div key={ingredient.id} className='ingredient container' style={{ color: (batchCode && isQuantitySufficient) ? 'inherit' : 'red' }}>
              <p>
                <strong>{ingredient.name}:</strong>
                {ingredient.name !== "Flour (Caputo Blue)" && ingredient.name !== "Wholemeal Flour" && ingredient.name !== "Salt" && ingredient.name !== "Rye Flour" &&
                  ` ${formatQuantity(numberOfUnits)} ${ingredientQuantity.unit}`
                }
              </p>
              {/* Check for insufficient allocation quantities */}
              {(() => {
                if (!batchCode) return null;
                
                // Parse batch codes to calculate total allocated quantity
                const totalAllocated = batchCode.split(',').reduce((sum, item) => {
                  const [code, qty] = item.trim().split(':');
                  return sum + (qty ? parseFloat(qty) : 0);
                }, 0);
                
                // Check if total allocated is insufficient
                const isInsufficient = totalAllocated < numberOfUnits;
                
                return isInsufficient ? (
                  <p style={{ color: 'red', fontSize: '0.9em', margin: '0 0 5px 0' }}>
                    *insufficient allocation quantities
                  </p>
                ) : null;
              })()}
              {editingField === `ingredient-${ingredient.name}` ? (
                <div ref={batchEditingRef}>
                  {shouldUseDeliveryDropdown(viewingBatch.batch_code) ? (
                    <div className="batchButtonContainer" style={{ marginTop: '10px' }}>
                      {(() => {
                        const filteredDeliveries = deliveries
                          .filter(delivery =>
                            delivery.batchCodes &&
                            delivery.batchCodes[ingredient.name]
                          );
                        // Find the delivery with the earliest delivery date (farthest right after sort)
                        const sortedDeliveries = filteredDeliveries.sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
                        const earliestDelivery = sortedDeliveries[sortedDeliveries.length - 1];
                        return sortedDeliveries.map((delivery, idx) => {
                          const isEarliest = delivery === earliestDelivery;
                          // ...existing code...
                          const batchCode = delivery.batchCodes[ingredient.name];
                          // Parse batch codes and quantities
                          const parseBatchData = (batchString) => {
                            if (!batchString) return [];
                            return batchString.split(',').map(item => {
                              const [code, qty] = item.trim().split(':');
                              return { code: code.trim(), quantity: qty ? parseFloat(qty) : 0 };
                            });
                          };

                          // Use the most current batch code value (either from editingValue or the actual batchCode)
                          const currentBatchString = editingValue || batchCode || '';
                          const currentBatchData = parseBatchData(currentBatchString);
                          const currentBatch = currentBatchData.find(b => b.code === batchCode);
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
                                // Don't trigger if clicking on input or qty used area
                                if (e.target.tagName === 'INPUT' || e.target.closest('.qtyUsed')) return;
                                
                                if (isSelected) {
                                  // Remove this batch from the list (only if it has quantity > 0)
                                  const updatedBatchData = currentBatchData.filter(b => b.code !== batchCode);
                                  
                                  // If only one batch remains, max it out to full quantity needed
                                  if (updatedBatchData.length === 1) {
                                    const remainingBatch = updatedBatchData[0];
                                    const remainingBatchDelivery = deliveries.find(del => 
                                      del.batchCodes && 
                                      del.batchCodes[ingredient.name] === remainingBatch.code
                                    );
                                    
                                    if (remainingBatchDelivery) {
                                      // Calculate available stock for remaining batch
                                      const remainingDeliveredQty = remainingBatchDelivery.quantities && remainingBatchDelivery.quantities[ingredient.name] 
                                        ? parseInt(remainingBatchDelivery.quantities[ingredient.name]) || 0 
                                        : 0;
                                      
                                      const remainingAllocatedQty = (remainingBatchDelivery.allocations || [])
                                        .filter(alloc => 
                                          alloc.ingredientName === ingredient.name && 
                                          remainingBatchDelivery.batchCodes && 
                                          remainingBatchDelivery.batchCodes[ingredient.name] === remainingBatch.code
                                        )
                                        .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                      
                                      const remainingFoundStock = remainingBatchDelivery.foundStock && remainingBatchDelivery.foundStock[ingredient.name] 
                                        ? parseFloat(remainingBatchDelivery.foundStock[ingredient.name]) || 0 
                                        : 0;
                                      
                                      const remainingAvailableStock = remainingDeliveredQty - remainingAllocatedQty + remainingFoundStock;
                                      
                                      // Max out the remaining batch to full quantity needed (or available stock)
                                      remainingBatch.quantity = Math.min(numberOfUnits, remainingAvailableStock);
                                    }
                                  }
                                  
                                  const newValue = updatedBatchData.length > 0 
                                    ? updatedBatchData.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ')
                                    : '';
                                  setEditingValue(newValue);
                                  handleInlineSave("ingredient", ingredient.name, null, newValue);
                                } else {
                                  // Add this batch to the list
                                  // First remove any existing entry for this batch code (including zero quantity ones)
                                  let newBatchData = currentBatchData.filter(b => b.code !== batchCode);
                                  
                                  // Calculate available stock for this batch
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
                                  
                                  const availableStock = deliveredQty - allocatedQty + foundStock;
                                  
                                  if (newBatchData.length === 0) {
                                    // First batch gets full quantity but capped at available stock
                                    const quantity = Math.min(numberOfUnits, availableStock);
                                    newBatchData.push({ code: batchCode, quantity: quantity });
                                  } else if (newBatchData.length === 1) {
                                    // Second batch: prioritize by delivery date (older first)
                                    const currentDeliveryDate = new Date(delivery.deliveryDate);
                                    const firstBatchCode = newBatchData[0].code;
                                    
                                    // Find the first batch's delivery to compare dates
                                    const firstBatchDelivery = deliveries.find(del => 
                                      del.batchCodes && 
                                      del.batchCodes[ingredient.name] === firstBatchCode
                                    );
                                    const firstDeliveryDate = firstBatchDelivery ? new Date(firstBatchDelivery.deliveryDate) : new Date();
                                    
                                    // Calculate available stock for first batch too
                                    const firstDeliveredQty = firstBatchDelivery?.quantities?.[ingredient.name] 
                                      ? parseInt(firstBatchDelivery.quantities[ingredient.name]) || 0 
                                      : 0;
                                    
                                    const firstAllocatedQty = (firstBatchDelivery?.allocations || [])
                                      .filter(alloc => 
                                        alloc.ingredientName === ingredient.name && 
                                        firstBatchDelivery.batchCodes && 
                                        firstBatchDelivery.batchCodes[ingredient.name] === firstBatchCode
                                      )
                                      .reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                                    
                                    const firstFoundStock = firstBatchDelivery?.foundStock && firstBatchDelivery.foundStock[ingredient.name] 
                                      ? parseFloat(firstBatchDelivery.foundStock[ingredient.name]) || 0 
                                      : 0;
                                    
                                    const firstAvailableStock = firstDeliveredQty - firstAllocatedQty + firstFoundStock;
                                    
                                    // Keep existing allocation for first batch, only add what's needed for second batch
                                    const existingFirstBatchQuantity = newBatchData[0].quantity;
                                    const remainingQuantityNeeded = numberOfUnits - existingFirstBatchQuantity;
                                    const secondBatchQuantity = Math.min(remainingQuantityNeeded, availableStock);
                                    
                                    newBatchData.push({ code: batchCode, quantity: secondBatchQuantity });
                                  }
                                  
                                  const newValue = newBatchData.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ');
                                  setEditingValue(newValue);
                                  setBatchQuantityInput(Math.min(numberOfUnits, availableStock).toFixed(2));
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
                                  
                                  const qtyInStock = deliveredQty - allocatedQty + foundStock;
                                  return `${qtyInStock.toFixed(1)} ${ingredient.packaging || 'units'}`;
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
                                      style={{ 
                                        textDecoration: 'underline', 
                                        cursor: 'pointer',
                                        display: 'inline-block'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBatchInput(batchInputKey);
                                        setBatchQuantityInput(currentBatch ? currentBatch.quantity.toFixed(2) : '0');
                                      }}
                                    >
                                      {currentBatch ? currentBatch.quantity.toFixed(2) : '0'}
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
                                          const newValue = updatedBatchData.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ');
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
                                            const newValue = updatedBatchData.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ');
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
                <p onClick={() => {
                  setEditingField(`ingredient-${ingredient.name}`);
                  setEditingValue(batchCode || "");
                }}>
                  {batchCode ? (
                    <div className='selectedBatch'>
                      Batch Code{batchCode.includes(',') ? 's' : ''}: {
                        batchCode.split(',').map(item => {
                          const [code, qty] = item.trim().split(':');
                          return qty ? `${code}` : code;
                        }).join(', ')
                      }
                    </div>
                  ) : (
                    <span style={{ color: 'red' }}>+</span>
                  )}
                </p>
              )}
            </div>
          );
        })}

        
      </div>
    </div>
  );
}

export default BatchCodesSection;