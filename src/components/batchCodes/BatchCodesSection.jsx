import React from 'react';

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

          return (
            <div key={ingredient.id} className='ingredient container' style={{ color: batchCode ? 'inherit' : 'red' }}>
              <p>
                <strong>{ingredient.name}:</strong>
                {ingredient.name !== "Flour (Caputo Blue)" && ingredient.name !== "Flour (Wholemeal)" && ingredient.name !== "Salt" && ingredient.name !== "Rye Flour" &&
                  ` ${formatQuantity(numberOfUnits)} ${ingredientQuantity.unit}`
                }
              </p>
              {editingField === `ingredient-${ingredient.name}` ? (
                <div>
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
                          const isSelected = editingValue === batchCode;

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
                                  // Deselect the batch
                                  setEditingValue("");
                                  handleInlineSave("ingredient", ingredient.name, null, "");
                                } else {
                                  // Select the batch and set quantity to ingredient needed
                                  setEditingValue(batchCode);
                                  setBatchQuantityInput(numberOfUnits.toFixed(2));
                                  handleInlineSave("ingredient", ingredient.name, null, batchCode);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="batchLabel">
                                <div>Batch Code: {batchCode} </div> 
                                <div> Qty in Stock: {} </div>
                                <div>Delivered: {new Date(delivery.deliveryDate).toLocaleDateString('en-GB')} </div>
                                <div className='qtyUsed'>
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
                                        // Switch to input mode when clicking on the underlined value
                                        setSelectedBatchInput(batchInputKey);
                                        setBatchQuantityInput(isSelected ? numberOfUnits.toFixed(2) : '0');
                                      }}
                                    >
                                      {isSelected ? numberOfUnits.toFixed(2) : '0'}
                                    </div>
                                  )}
                                  {showInput && (
                                    <div>
                                      <input
                                        type="number"
                                        value={batchQuantityInput}
                                        onChange={(e) => setBatchQuantityInput(e.target.value)}
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
                                          setEditingValue(batchCode);
                                          handleInlineSave("ingredient", ingredient.name, null, batchCode);
                                          setSelectedBatchInput(null);
                                          setBatchQuantityInput('');
                                        }}
                                        onKeyDown={(e) => {
                                          e.stopPropagation();
                                          if (e.key === 'Enter') {
                                            setEditingValue(batchCode);
                                            handleInlineSave("ingredient", ingredient.name, null, batchCode);
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
                  {batchCode ? <div className='selectedBatch'>Batch Code: {batchCode}</div> : <span style={{ color: 'red' }}>+</span>}
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