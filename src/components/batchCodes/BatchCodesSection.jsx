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
  removeStockAllocation
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

  return (
    <div>
      <h4>Batch Codes:</h4>
      <div className='ingredientBatchcodeBox'>
        <div className='ingredient container' style={{
          color: viewingBatch.starter_batch_code ? 'inherit' : 'red',
          marginBottom: !viewingBatch.starter_batch_code ? '14px' : undefined
        }}>
          <div className='starter'><strong>Starter: </strong></div>
          {editingField === 'starter-batch' ? (
            <select
              value={editingValue}
              autoFocus
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => handleInlineSave("batch", null, "starter_batch_code", editingValue)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleInlineSave("batch", null, "starter_batch_code", editingValue);
                }
              }}
            >
              <option value="">Select starter batch...</option>
              {batches
                .filter(batch => batch.batch_type === 'starter')
                .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
                .map(batch => (
                  <option key={batch.id} value={batch.batch_code}>
                    {batch.batch_code} - {formatDateDisplay(batch.batch_date)}
                  </option>
                ))}
            </select>
          ) : (
            <div className='starter' onClick={() => {
              setEditingField('starter-batch');
              setEditingValue(viewingBatch.starter_batch_code || "");
            }}>
              {viewingBatch.starter_batch_code ? `# ${viewingBatch.starter_batch_code}` : <span style={{ color: 'red' }}>+</span>}
            </div>
          )}
        </div>

        {/* Display rye & caputo batch codes from selected starter */}
        {viewingBatch.starter_batch_code && (() => {
          const selectedStarter = batches.find(batch =>
            batch.batch_type === 'starter' && batch.batch_code === viewingBatch.starter_batch_code
          );
          return selectedStarter ? (
            <div style={{ marginLeft: '20px', fontSize: '0.9em', marginTop: '5px' }}>
              {selectedStarter.ingredientBatchCodes?.['Rye Flour'] && (
                <div style={{ color: '#666' }}>
                  Rye: #{selectedStarter.ingredientBatchCodes['Rye Flour']}
                </div>
              )}
              {selectedStarter.ingredientBatchCodes?.['Flour (Caputo Blue)'] && (
                <div style={{ color: '#666' }}>
                  Caputo Blue: #{selectedStarter.ingredientBatchCodes['Flour (Caputo Blue)']}
                </div>
              )}
              {selectedStarter.ingredientBatchCodes?.['Flour (Wholemeal)'] && (
                <div style={{ color: '#666' }}>
                  Wholemeal: #{selectedStarter.ingredientBatchCodes['Flour (Wholemeal)']}
                </div>
              )}
            </div>
          ) : null;
        })()}

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
                {ingredient.name !== "Flour (Caputo Blue)" && ingredient.name !== "Flour (Wholemeal)" && ingredient.name !== "Salt" && ingredient.name !== "Rye Flour" &&
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
                      {deliveries
                        .filter(delivery =>
                          delivery.batchCodes &&
                          delivery.batchCodes[ingredient.name]
                        )
                        .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate))
                        .map(delivery => {
                          const batchCode = delivery.batchCodes[ingredient.name];
                          // Parse batch codes and quantities
                          const parseBatchData = (batchString) => {
                            if (!batchString) return [];
                            return batchString.split(',').map(item => {
                              const [code, qty] = item.trim().split(':');
                              return { code, quantity: qty ? parseFloat(qty) : numberOfUnits };
                            });
                          };

                          const currentBatchData = parseBatchData(editingValue);
                          const currentBatch = currentBatchData.find(b => b.code === batchCode);
                          const isSelected = currentBatchData.some(b => b.code === batchCode);

                          const batchInputKey = `${delivery.id}-${ingredient.name}`;
                          const showInput = selectedBatchInput === batchInputKey;
                          const isSelectedOrShowingInput = isSelected || showInput;

                          return (
                            <div
                              key={`${delivery.id}-${ingredient.name}`}
                              className={`batchSelect ${isSelectedOrShowingInput ? 'selectedBatch' : 'notSelectedBatch'}`}
                              onClick={(e) => {
                                // Don't trigger if clicking on input or qty used area
                                if (e.target.tagName === 'INPUT' || e.target.closest('.qtyUsed')) return;
                                
                                if (isSelected) {
                                  // Deselect this batch - remove it from the list
                                  const updatedBatchData = currentBatchData.filter(b => b.code !== batchCode);
                                  const newValue = updatedBatchData.length > 0 
                                    ? updatedBatchData.map(b => `${b.code}:${b.quantity.toFixed(2)}`).join(', ')
                                    : '';
                                  setEditingValue(newValue);
                                  handleInlineSave("ingredient", ingredient.name, null, newValue);
                                } else {
                                  // Select this batch - add it to the list
                                  const newBatchData = [...currentBatchData];
                                  
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
                                  
                                  const availableStock = deliveredQty - allocatedQty;
                                  
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
                                    
                                    const firstAvailableStock = firstDeliveredQty - firstAllocatedQty;
                                    
                                    // Determine which batch to prioritize (earlier delivery date first)
                                    if (firstDeliveryDate <= currentDeliveryDate) {
                                      // First batch is older, give it priority
                                      const firstBatchQuantity = Math.min(numberOfUnits, firstAvailableStock);
                                      const remainingQuantity = numberOfUnits - firstBatchQuantity;
                                      const secondBatchQuantity = Math.min(remainingQuantity, availableStock);
                                      
                                      newBatchData[0].quantity = firstBatchQuantity;
                                      newBatchData.push({ code: batchCode, quantity: secondBatchQuantity });
                                    } else {
                                      // Second (current) batch is older, give it priority
                                      const secondBatchQuantity = Math.min(numberOfUnits, availableStock);
                                      const remainingQuantity = numberOfUnits - secondBatchQuantity;
                                      const firstBatchQuantity = Math.min(remainingQuantity, firstAvailableStock);
                                      
                                      newBatchData[0].quantity = firstBatchQuantity;
                                      newBatchData.push({ code: batchCode, quantity: secondBatchQuantity });
                                    }
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
                                  // Calculate quantity in stock: delivered - allocated
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
                                  
                                  const qtyInStock = deliveredQty - allocatedQty;
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
                                          
                                          const maxAvailable = deliveredQty - allocatedQty;
                                          
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
                                          
                                          const maxAvailable = deliveredQty - allocatedQty;
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
                                            
                                            const maxAvailable = deliveredQty - allocatedQty;
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
                        })
                      }
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